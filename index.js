(function() {

	let headerColsSelector;
	let laneColsSelector;
	let estimateSelector;
	let sprintTitleSelector;

	let sumElTag;
	let colSumElClass;
	let totalSumElClass;

	let observeSwimlanesSelector;
	let observeIssuesSelector;
	let observeRefreshSelector;

	const timeEstimateChars = ['w', 'd', 'h', 'm'];

	function $(selector) {
		return Array.from(document.querySelectorAll(selector));
	}

	const JiraEstimatesSum = {

		init: function() {
			window.addEventListener('load', () => {
				this.main();
				this.startBackgroundScriptListeners();
			});
		},

		main: function() {
			if (this.setupBoardType()) {
				this.setupSelectors();
				this.setupElements();
				this.areEstimatesTime = this.determineEstimateType();
				this.colSumById = {};
				this.sumCols();
				this.writeColSum();
				this.writeTotalSum();
				const observerConfig = this.setupObserverOptions();
				this.startObservers(observerConfig);
			}
		},

		setupBoardType: function() {
			const $laneColsClassic = $('.ghx-swimlane .ghx-column');
			const $laneColsNextGen = $('.__board-test-hook__card-list-container');

			if ($laneColsClassic.length) {
				this.isBoardTypeClassic = true;
				return true;
			} else if ($laneColsNextGen.length) {
				this.isBoardTypeNextGen = true;
				return true;
			}

			return false;
		},

		setupSelectors: function() {
			sumElTag = 'aui-badge';
			colSumElClass = 'JiraEstimatesSum-ColSum';

			if (this.isBoardTypeClassic) {
				headerColsSelector = '.ghx-column-headers .ghx-column';
				laneColsSelector = '.ghx-swimlane .ghx-column';
				estimateSelector = '.ghx-estimate';

				sprintTitleSelector = '#subnav-title';

				totalSumElClass = 'JiraEstimatesSum-TotalSum';

				observeLoadingIndicatorSelector = '.adg-throbber';
				observeSwimlanesSelector = '.ghx-pool';
				observeIssuesSelector = '.ghx-wrap-issue';
				observeRefreshSelector = '.ghx-column-header-group';
			} else if (this.isBoardTypeNextGen) {
				headerColsSelector = '[data-test-id="platform-board-kit.common.ui.column-header.header.column-header-container"]';
				laneColsSelector = '.__board-test-hook__card-list-container';
				estimateSelector = '[data-test-id="platform-board-kit.ui.card.card"]';

				sprintTitleSelector = '[data-test-id="software-board.board"] h2';

				totalSumElClass = 'JiraEstimatesSum-TotalSum--nextGen';

				observeColSelector = '.__board-test-hook__card-list-container';
				observeIssuesSelector = '[data-test-id="platform-board-kit.ui.card.card"]';
			}
		},

		setupElements: function() {
			if (this.isBoardTypeClassic) {
				this.$headerCols = $(headerColsSelector);
			} else if (this.isBoardTypeNextGen) {
				this.$headerCols = $(headerColsSelector).map(($item) => {
					return $item.children[0];
				});
			}
		},

		determineEstimateType: function() {
			$estimates = $(`${laneColsSelector} ${estimateSelector}`);

			return $estimates
				.map(($estimate) => {
					if (this.isBoardTypeClassic) {
						return $estimate.textContent;
					} else if (this.isBoardTypeNextGen) {
						return $estimate.lastChild.lastChild.children[0].lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild.textContent;
					}
				})
				.filter((estimate) => typeof estimate === 'string')
				.some((estimate) => timeEstimateChars.some(
					(char) =>
						estimate.includes(char)
					)
				);
		},

		formatTimeSum: function(timeEstimates = []) {
			const parsedEstimates = timeEstimates.map((estimate) => {

				let sortedEstimates = {};

				estimate.split(' ').forEach((segment) => {
					const timeSegment = timeEstimateChars.filter(
						(char) => segment.includes(char)
					);

					if (timeSegment.length > 0) {
						const timeValue = segment.split(timeSegment)[0];
						sortedEstimates[timeSegment] = parseInt(timeValue);
					}
				})

				return sortedEstimates;
			});

			let laneEstimates = {};

			parsedEstimates.forEach((timeEstimate) => {
				if (timeEstimate) {
					for (let [key, value] of Object.entries(timeEstimate)) {
						if (laneEstimates[key]) {
							laneEstimates[key] = Number(laneEstimates[key]) + Number(value);
						} else {
							laneEstimates[key] = value;
						}
					}
				}
			});

			/**
			 * Sum up values to jira defaults (60m, 8h, 5d)
			 */

			if (laneEstimates['m'] && laneEstimates['m'] >= 60) {
				const extraHours = Math.floor(laneEstimates['m'] / 60);

				laneEstimates['m'] = laneEstimates['m'] % 60;

				if (laneEstimates['h']) {
					laneEstimates['h'] = laneEstimates['h'] + extraHours;
				} else {
					laneEstimates['h'] = extraHours;
				}
			}

			if (laneEstimates['h'] && laneEstimates['h'] >= 8) {
				const extraDays = Math.floor(laneEstimates['h'] / 8);

				laneEstimates['h'] = laneEstimates['h'] % 8;

				if (laneEstimates['d']) {
					laneEstimates['d'] = laneEstimates['d'] + extraDays;
				} else {
					laneEstimates['d'] = extraDays;
				}
			}

			if (laneEstimates['d'] && laneEstimates['d'] >= 5) {
				const extraWeeks = Math.floor(laneEstimates['d'] / 5);

				laneEstimates['d'] = laneEstimates['d'] % 5;

				if (laneEstimates['w']) {
					laneEstimates['w'] = laneEstimates['w'] + extraWeeks;
				} else {
					laneEstimates['w'] = extraWeeks;
				}
			}

			let formattedSum = '';

			/**
			 * Add up values by key and sort them properly.
			 */
			for (let [key, value] of Object.entries(timeEstimateChars)) {
				if (laneEstimates[value]) {
					formattedSum = `${formattedSum} ${laneEstimates[value]}${value}`;
				}
			}

			return formattedSum;
		},

		countDecimals: function (value) {
			return value.toString().split('.')[1]?.length || 0;
		},

		formatNumberSum: function(numberEstimates = []) {
			const parsedEstimates = numberEstimates
				.map((estimate) => parseFloat(estimate))
				.filter((item) => typeof item === 'number' && !Number.isNaN(item));

			const decimalCount = parsedEstimates
				.map((number) => this.countDecimals(number));

			const maxDecimals = Math.max(
				...decimalCount
			);

			return parsedEstimates.reduce((sum, current) => {
				return Number((Number(sum) + Number(current)).toFixed(maxDecimals));
			}, 0);
		},

		sumCols: function() {
			const columnIds = this.$headerCols.map(($column) => {
				if (this.isBoardTypeNextGen) {
					return $column.dataset.rbdDragHandleDraggableId;
				} else if (this.isBoardTypeClassic) {
					return $column.dataset.id;
				}
			});

			columnIds.forEach((id) => {
				let columnHasEstimateEls = false;
				const $laneCols = $(laneColsSelector);

				const columnSum = $laneCols.filter(($laneCol) => {
						if (this.isBoardTypeClassic) {
							return $laneCol.dataset.columnId === id;
						} else if (this.isBoardTypeNextGen) {
							return $laneCol.dataset.rbdDroppableId.includes(id);
						}
					})
					.reduce((laneColSum, $laneCol) => {

						let $estimates;

						if (this.isBoardTypeClassic) {
							$estimates = Array.from($laneCol.querySelectorAll(estimateSelector));
						} else if (this.isBoardTypeNextGen) {
							$estimates = Array.from($laneCol.querySelectorAll(estimateSelector)).map(($issue) => {
								return $issue.lastChild.lastChild.children[0].lastChild.lastChild
									.lastChild.lastChild.lastChild.lastChild.lastChild.lastChild;
							});
						}

						if ($estimates.length) {
							columnHasEstimateEls = true;

							const estimatesSum = $estimates.reduce((sum, $estimate) => {
								return this.areEstimatesTime ?
									this.formatTimeSum([sum, $estimate.textContent]) :
									this.formatNumberSum([sum, $estimate.textContent]);
							}, '');

							return this.areEstimatesTime ?
								this.formatTimeSum([laneColSum, estimatesSum]) :
								this.formatNumberSum([laneColSum, estimatesSum]);
						} else {
							return laneColSum;
						}
					}, '');

				/**
				 * Kanban board has no estimate elements shown,
				 * so it's column sum shouldn't be displayed.
				 * Estimates can exist, but aren't shown in story elements,
				 * so it would br wrong to display zero.
				 */
				if (columnHasEstimateEls) {
					this.colSumById[id] = columnSum;
				}
			});
		},

		writeColSum: function() {
			Object.entries(this.colSumById).forEach(([ id, colSum ]) => {
				const $targetCol = this.$headerCols.find(($column) => {
					if (this.isBoardTypeClassic) {
						return $column.dataset.id === id;
					} else if (this.isBoardTypeNextGen) {
						return $column.dataset.rbdDragHandleDraggableId === id;
					}
				});

				/**
				 * Remove existing element on refresh
				 */
				$targetCol.querySelector(`.${colSumElClass}`)?.remove();

				/**
				 * Result can be empty string.
				 * To avoid a styled element with no content,
				 * append an element only if it has a number as content
				 */
				if (typeof colSum === 'number' || colSum.length > 0) {
					const $colSum = this.generateSumElement(colSumElClass, colSum);

					$targetCol.children[0]?.appendChild($colSum);
				}
			});
		},

		writeTotalSum: function() {
			const totalSum = Object.values(this.colSumById)
				.reduce((total, colSum) => {
					if (typeof colSum === 'number' || colSum.length > 0) {
						return this.areEstimatesTime ?
							this.formatTimeSum([total, colSum]) :
							this.formatNumberSum([total, colSum]);
					} else {
						return total;
					}
				}, '');

			/**
			 * Remove existing element on refresh
			 */
			document.querySelector(`.${totalSumElClass}`)?.remove();

			/**
			 * Result can be empty string.
			 * To avoid a styled element with no content,
			 * append an element only if it has a number as content
			 */
			if (typeof totalSum === 'number' || totalSum.length > 0) {
				const $totalSum = this.generateSumElement(totalSumElClass, totalSum);

				document.querySelector(sprintTitleSelector)
					.appendChild($totalSum);
			}
		},

		generateSumElement: function(cssClass, content) {
			const $el = document.createElement(sumElTag);
			$el.classList.add(cssClass);
			$el.textContent = content;

			return $el;
		},

		setupObserverOptions: function() {
			let observerConfig = [];

			if (this.isBoardTypeClassic) {
				observerConfig = [
					// swimlanes
					{
						$elements: $('.ghx-pool'),
						options:  { childList: true }
					},
					// issues
					{
						$elements: $('.ghx-wrap-issue'),
						options:  { childList: true }
					},
					// refresh
					{
						$elements: $('.ghx-column-header-group'),
						options:  { attributes: true }
					},
				];
			} else if (this.isBoardTypeNextGen) {
				observerConfig = [
					// cols
					{
						$elements: $(observeColSelector),
						options:  { childList: true }
					},
					// estimates
					{
						$elements: $(estimateSelector).map(($issue) => {
							return $issue.lastChild.lastChild.children[0].lastChild.lastChild
							.lastChild.lastChild.lastChild.lastChild.lastChild;
						}),
						options:  { childList: true }
					}
				];
			}

			return observerConfig;
		},

		startObservers: function(observerConfig) {
			const observerCallback = (mutationsList, observer) => {
				this.stopObservers();
				setTimeout(() => {
					this.main();
				}, 500);
			};

			this.observer = new MutationObserver(() => {
				observerCallback();
			});

			observerConfig.forEach(({ $elements, options }) => {
				$elements.forEach(($el) => {
					this.observer.observe($el, options);
				});
			});
		},

		stopObservers: function() {
			this.observer?.disconnect();
		},

		startBackgroundScriptListeners: function() {
			chrome.runtime.sendMessage({ startListening : true }, (response, error) => {
				if (
					response.action === 'backgroundListeningToTab'
				) {
					chrome.runtime.onMessage.addListener((message) => {
						if (
							message?.action === 'onActivated' ||
							message?.action === 'onHistoryStateUpdated'
						) {
							this.stopObservers();
							setTimeout(() => {
								this.main();
							}, 500);

						}
					});
				}
			});
		}

	};

	JiraEstimatesSum.init();
}());
