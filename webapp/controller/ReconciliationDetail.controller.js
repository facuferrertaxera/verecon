sap.ui.define([
    "tech/taxera/taxreporting/verecon/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/model/json/JSONModel",
    "tech/taxera/taxreporting/verecon/utils/formatter",
    "tech/taxera/taxreporting/verecon/utils/types",
], (BaseController, Filter, FilterOperator, Sorter, JSONModel, formatter, types) => {
    "use strict";

    const ReconciliationDetailController = BaseController.extend("tech.taxera.taxreporting.verecon.controller.ReconciliationDetail", {
        formatter: formatter,
        types: types,

        onInit() {
            // Initialize view model
            const oViewModel = new JSONModel({
                reconciliationDetail: {
                    headerExpanded: true,
                    titleClickable: true,
                    chartFiltersVisible: true,
                    chartsHeight: "200px",
                    donutHeight: "150px",
                    totalDifference: {
                        value: 0,
                        count: 0,
                        scale: "EUR",
                        text: "Total Difference"
                    },
                    donutChartData: {
                        segments: []
                    },
                    statusCards: {
                        notInEcsl: {
                            count: 0,
                            total: 0
                        },
                        notInVatr: {
                            count: 0,
                            total: 0
                        },
                        mismatched: {
                            count: 0,
                            total: 0
                        }
                    },
                    selectedStatusFilters: [], // Array of selected status filters
                    showOnlyDifferences: false
                }
            });
            this.getView().setModel(oViewModel, "view");


            // Get router and attach route matched handler
            const oRouter = this.getRouter();
            if (oRouter) {
                oRouter.getRoute("ReconciliationDetail").attachPatternMatched(this._onRouteMatched, this);
            }
        },

        /**
         * Gets the AnalyticalTable from SmartTable
         * @returns {sap.ui.table.AnalyticalTable|null} The AnalyticalTable instance or null
         */
        _getAnalyticalTable: function() {
            const oSmartTable = this.byId("documentsSmartTable");
            if (!oSmartTable) {
                return null;
            }
            
            // Try getTable method first
            if (oSmartTable.getTable) {
                const oTable = oSmartTable.getTable();
                if (oTable && oTable.isA && oTable.isA("sap.ui.table.AnalyticalTable")) {
                    return oTable;
                }
            }
            
            // Try to find in aggregations
            const oContent = oSmartTable.getContent && oSmartTable.getContent();
            if (oContent && oContent.isA && oContent.isA("sap.ui.table.AnalyticalTable")) {
                return oContent;
            }
            
            // Try to find by searching aggregations
            const aAggregations = oSmartTable.getAggregation("content") || [];
            for (let i = 0; i < aAggregations.length; i++) {
                if (aAggregations[i] && aAggregations[i].isA && aAggregations[i].isA("sap.ui.table.AnalyticalTable")) {
                    return aAggregations[i];
                }
            }
            
            return null;
        },

        /**
         * Handler for DynamicPage header toggle
         */
        onToggleHeader: function(oEvent) {
            const bExpanded = oEvent.getParameter("expanded");
            // Update view model
            const oViewModel = this.getView().getModel("view");
            if (oViewModel) {
                oViewModel.setProperty("/reconciliationDetail/headerExpanded", bExpanded);
            }
        },

        _onRouteMatched: function(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sReconId = oArgs.reconId;
            
            if (!sReconId) {
                return;
            }

            // Store ReconId for filtering DocumentSUM
            this._sReconId = sReconId;

            // Get the reconciliation context
            // Format GUID correctly for OData V2: guid'...'
            const sReconciliationPath = `/Reconciliation(guid'${sReconId}')`;
            
            // Bind the view to the reconciliation
            this.getView().bindElement({
                path: sReconciliationPath,
                events: {
                    dataRequested: () => {
                        this.getView().setBusy(true);
                    },
                    dataReceived: (oEvent) => {
                        this.getView().setBusy(false);
                        
                        // Check if binding was successful
                        const oBindingContext = this.getView().getBindingContext();
                        if (!oBindingContext) {
                            this.showErrorMessage({ responseText: JSON.stringify({ error: { message: { value: "Failed to load reconciliation data" } } }) });
                            return;
                        }
                        
                        // Populate tokenizers with reconciliation data
                        this._populateReconciliationDetails();
                        
                        // After reconciliation is loaded, bind the SmartTable and load totals
                        this._bindDocumentsTable(sReconciliationPath);
                        
                        // Load total difference, donut chart, and status card data from the full unfiltered dataset
                        this._loadTotalDifference();
                        this._loadDonutChartData();
                        this._loadStatusCardData();
                    },
                    change: (oEvent) => {
                        // Handle binding errors
                        if (!oEvent.getParameter("bindingContext")) {
                            this.getView().setBusy(false);
                        }
                    }
                }
            });
        },

        /**
         * Store ReconId for filtering DocumentSUM
         */
        _sReconId: null,

        /**
         * Handler for SmartTable beforeRebindTable event
         * Filters DocumentSUM by ReconId and applies additional filters
         */
        onBeforeRebindDocumentsTable: function(oEvent) {
            const oBindingParams = oEvent.getParameter("bindingParams");
            
            // Get existing filters or initialize empty array
            let aFilters = oBindingParams.filters || [];
            
            // Add filter for ReconId if available
            if (this._sReconId) {
                // Remove any existing ReconId filter
                aFilters = aFilters.filter(function(oFilter) {
                    return oFilter.sPath !== "ReconId";
                });
                
                // Add ReconId filter
                aFilters.push(new Filter({
                    path: "ReconId",
                    operator: FilterOperator.EQ,
                    value1: this._sReconId
                }));
            }
            
            // Get filter flags from view model
            const oViewModel = this.getView().getModel("view");
            const bShowOnlyDifferences = oViewModel ? oViewModel.getProperty("/reconciliationDetail/showOnlyDifferences") : false;
            const aSelectedStatusFilters = oViewModel ? oViewModel.getProperty("/reconciliationDetail/selectedStatusFilters") || [] : [];
            
            // Remove any existing custom filters (DiffGrossAmount, EcslGrossAmount, VatrGrossAmount, Status)
            aFilters = aFilters.filter(function(oFilter) {
                // Check if this is one of our custom filters
                if (oFilter.sPath === "DiffGrossAmount" || oFilter.sPath === "EcslGrossAmount" || 
                    oFilter.sPath === "VatrGrossAmount" || oFilter.sPath === "Status" || 
                    oFilter.sPath === "StatusText") {
                    return false;
                }
                // Check if it's a composite filter containing our custom filters
                if (oFilter.aFilters && Array.isArray(oFilter.aFilters)) {
                    const bContainsCustomFilter = oFilter.aFilters.some(function(oSubFilter) {
                        return oSubFilter.sPath === "DiffGrossAmount" || 
                               oSubFilter.sPath === "EcslGrossAmount" || 
                               oSubFilter.sPath === "VatrGrossAmount" || 
                               oSubFilter.sPath === "Status" || 
                               oSubFilter.sPath === "StatusText";
                    });
                    if (bContainsCustomFilter && oFilter.aFilters.length === 1) {
                        return false; // Remove if it's a single-filter composite
                    }
                }
                return true;
            });
            
            // Add filter to show only records with differences if flag is set
            if (bShowOnlyDifferences) {
                const oDiffFilter = new Filter("DiffGrossAmount", FilterOperator.NE, 0);
                aFilters.push(oDiffFilter);
            }
            
            // Add status filters if any status filters are selected
            if (aSelectedStatusFilters && aSelectedStatusFilters.length > 0) {
                const aStatusFilters = [];
                
                aSelectedStatusFilters.forEach(function(sStatusFilter) {
                    if (sStatusFilter === "NOT_IN_ECSL") {
                        // Not in EC Sales List: Status = "NE"
                        aStatusFilters.push(new Filter("Status", FilterOperator.EQ, "NE"));
                    } else if (sStatusFilter === "NOT_IN_VATR") {
                        // Not in VAT Return: Status = "NV"
                        aStatusFilters.push(new Filter("Status", FilterOperator.EQ, "NV"));
                    } else if (sStatusFilter === "TOTAL_DIFFERENCE") {
                        // Total Difference: Documents with differences (DiffGrossAmount != 0)
                        aStatusFilters.push(new Filter("DiffGrossAmount", FilterOperator.NE, 0));
                    } else if (sStatusFilter === "ERROR") {
                        // Error status: Status = "E"
                        aStatusFilters.push(new Filter("Status", FilterOperator.EQ, "E"));
                    } else if (sStatusFilter === "ALL_DIFFERENCES") {
                        // All differences: Status != "S" (all non-success statuses)
                        aStatusFilters.push(new Filter("Status", FilterOperator.NE, "S"));
                    } else if (sStatusFilter === "RECONCILED") {
                        // Reconciled: Status starts with "S" - create OR filter for common S statuses
                        const aSStatusFilters = ["S", "SR", "SV", "ST", "SX", "SS"].map(function(sStatus) {
                            return new Filter("Status", FilterOperator.EQ, sStatus);
                        });
                        aStatusFilters.push(new Filter({
                            filters: aSStatusFilters,
                            and: false
                        }));
                    }
                });
                
                // Combine all status filters with OR logic (any of the selected statuses)
                if (aStatusFilters.length > 0) {
                    if (aStatusFilters.length === 1) {
                        aFilters.push(aStatusFilters[0]);
                    } else {
                        aFilters.push(new Filter({
                            filters: aStatusFilters,
                            and: false // OR logic
                        }));
                    }
                }
            }
            
            // Set the filters
            oBindingParams.filters = aFilters;
            
            // Add grouping by CompanyCode and Box
            const aSorters = oBindingParams.sorter || [];
            aSorters.push(new Sorter("CompanyCode", false, this._groupByCompanyCodeAndBox.bind(this)));
            aSorters.push(new Sorter("Box", false));
            oBindingParams.sorter = aSorters;
            
            // Set numberOfExpandedLevels for AnalyticalTable to show 2 levels initially
            // This expands groups by CompanyCode and Box on first load
            oBindingParams.parameters.numberOfExpandedLevels = 2;
            
            // Set sumOnTop to display subtotals in group headers (on top) rather than at bottom
            oBindingParams.parameters.sumOnTop = true;
            
            // Add event handlers
            oBindingParams.events = {
                dataRequested: () => {
                    this.getView().setBusy(true);
                },
                dataReceived: (oEvent) => {
                    this.getView().setBusy(false);
                    // Configure AnalyticalTable properties
                    this._configureAnalyticalTable();
                }
            };
        },

        /**
         * Configure AnalyticalTable properties after it's created by SmartTable
         */
        _configureAnalyticalTable: function() {
            const oTable = this._getAnalyticalTable();
            
            if (oTable && oTable.isA && oTable.isA("sap.ui.table.AnalyticalTable")) {
                // Set AnalyticalTable properties
                oTable.setAlternateRowColors(true);
                oTable.setSelectionMode("None");
                oTable.setEnableColumnFreeze(true);
            }
        },

        /**
         * Group function for grouping by CompanyCode and Box
         * Used by AnalyticalTable for grouping
         */
        _groupByCompanyCodeAndBox: function(oContext) {
            const sCompanyCode = oContext.getProperty("CompanyCode") || "";
            const sBox = oContext.getProperty("Box") || "";
            const sKey = `${sCompanyCode}|${sBox}`;
            const sText = sBox ? `${sCompanyCode} - ${sBox}` : sCompanyCode;
            
            return {
                key: sKey,
                text: sText
            };
        },


        /**
         * Bind the documents SmartTable - triggers rebind with ReconId filter
         */
        _bindDocumentsTable: function(sReconciliationPath) {
            // Trigger rebind on the SmartTable
            // The ReconId filter will be applied in onBeforeRebindDocumentsTable
            const oSmartTable = this.byId("documentsSmartTable");
            if (oSmartTable) {
                oSmartTable.rebindTable();
            }
        },

        /**
         * Load total difference from the full unfiltered dataset using DocumentSUM analytical view
         * This should only be called once when route is matched
         * Uses aggregation to calculate totals - $select with aggregated fields acts like GROUP BY
         */
        _loadTotalDifference: async function() {
            if (!this._sReconId) {
                return;
            }

            try {
                // Read from DocumentSUM analytical view directly
                // Select only aggregated measure to get total sum across all documents
                // Using $select with aggregated fields calculates totals at the server
                const oResponse = await this.promRead("/DocumentSUM", {
                    filters: [
                        new Filter("ReconId", FilterOperator.EQ, this._sReconId),
                        new Filter("DiffGrossAmount", FilterOperator.NE, 0)
                    ],
                    urlParameters: {
                        "$select": "DiffGrossAmount"
                    }
                });

                if (oResponse && oResponse.results) {
                    let fTotalDifference = 0;
                    let iCount = 0;
                    
                    // With analytical view, selecting only aggregated measure without dimensions
                    // should return one row with the total, but may return multiple if grouped
                    // We'll sum all DiffGrossAmount values and count rows
                    oResponse.results.forEach((oDocument) => {
                        if (oDocument) {
                            const fDiffAmount = Math.abs(oDocument.DiffGrossAmount || 0);
                            // Use absolute value for total difference
                            fTotalDifference += fDiffAmount;
                            // Count rows (each row represents grouped documents)
                            if (fDiffAmount > 0) {
                                iCount++;
                            }
                        }
                    });
                    
                    const oViewModel = this.getView().getModel("view");
                    if (oViewModel) {
                        oViewModel.setProperty("/reconciliationDetail/totalDifference/value", fTotalDifference);
                        oViewModel.setProperty("/reconciliationDetail/totalDifference/count", iCount);
                    }
                }
            } catch (oError) {
                console.error("Error loading total difference:", oError);
            }
        },

        /**
         * Load donut chart data from the full unfiltered dataset using DocumentSUM analytical view
         * This should only be called once when route is matched
         * Uses aggregation to group by Status - $select with Status as dimension groups results
         */
        _loadDonutChartData: async function() {
            if (!this._sReconId) {
                return;
            }

            try {
                // Read from DocumentSUM analytical view directly
                // Select Status as dimension to group by status (acts like GROUP BY Status)
                // This returns one row per unique Status value
                const oResponse = await this.promRead("/DocumentSUM", {
                    filters: [
                        new Filter("ReconId", FilterOperator.EQ, this._sReconId)
                    ],
                    urlParameters: {
                        "$select": "Status,StatusText"
                    }
                });

                if (oResponse && oResponse.results) {
                    const mStatusCounts = {
                        "S": 0,  // Reconciled
                        "NE": 0, // Not in ECSL
                        "NV": 0, // Not in VAT Return
                        "E": 0   // Error
                    };

                    // Count rows by status (each row represents grouped documents with that status)
                    oResponse.results.forEach((oDocument) => {
                        if (!oDocument) {
                            return;
                        }

                        const sStatus = oDocument.Status || "";
                        if (mStatusCounts.hasOwnProperty(sStatus)) {
                            mStatusCounts[sStatus]++;
                        } else if (sStatus && sStatus.indexOf("S") === 0) {
                            // Any status starting with S is considered Reconciled
                            mStatusCounts["S"]++;
                        }
                    });

                    // Create segments array for donut chart
                    const aSegments = [
                        {
                            label: "Reconciled",
                            value: mStatusCounts["S"],
                            displayedValue: mStatusCounts["S"].toString(),
                            status: "S"
                        },
                        {
                            label: "Not in ECSL",
                            value: mStatusCounts["NE"],
                            displayedValue: mStatusCounts["NE"].toString(),
                            status: "NE"
                        },
                        {
                            label: "Not in VAT Return",
                            value: mStatusCounts["NV"],
                            displayedValue: mStatusCounts["NV"].toString(),
                            status: "NV"
                        },
                        {
                            label: "Other differences",
                            value: mStatusCounts["E"],
                            displayedValue: mStatusCounts["E"].toString(),
                            status: "E"
                        }
                    ];

                    const oViewModel = this.getView().getModel("view");
                    if (oViewModel) {
                        oViewModel.setProperty("/reconciliationDetail/donutChartData/segments", aSegments);
                    }
                }
            } catch (oError) {
                console.error("Error loading donut chart data:", oError);
            }
        },

        /**
         * Load status card data from the full unfiltered dataset using DocumentSUM analytical view
         * This should only be called once when route is matched
         * Uses aggregation to group by Status and sum DiffGrossAmount - $select acts like GROUP BY
         */
        _loadStatusCardData: async function() {
            if (!this._sReconId) {
                return;
            }

            try {
                // Read from DocumentSUM analytical view directly
                // Select Status as dimension and DiffGrossAmount as aggregated measure
                // This groups by Status and sums DiffGrossAmount for each status group
                const oResponse = await this.promRead("/DocumentSUM", {
                    filters: [
                        new Filter("ReconId", FilterOperator.EQ, this._sReconId)
                    ],
                    urlParameters: {
                        "$select": "Status,StatusText,DiffGrossAmount"
                    }
                });

                if (oResponse && oResponse.results) {
                    const mStatusData = {
                        notInEcsl: { count: 0, total: 0 },
                        notInVatr: { count: 0, total: 0 },
                        mismatched: { count: 0, total: 0 }
                    };

                    // Process grouped results - each row is already grouped by Status with aggregated DiffGrossAmount
                    oResponse.results.forEach((oDocument) => {
                        if (!oDocument) {
                            return;
                        }

                        const fDiffAmount = Math.abs(oDocument.DiffGrossAmount || 0);
                        const sStatus = oDocument.Status || "";

                        // Not in EC Sales List: Status = "NE"
                        if (sStatus === "NE") {
                            mStatusData.notInEcsl.count++; // Count of groups (represents documents)
                            mStatusData.notInEcsl.total += fDiffAmount; // Sum of aggregated DiffGrossAmount
                        }
                        // Not in VAT Return: Status = "NV"
                        else if (sStatus === "NV") {
                            mStatusData.notInVatr.count++; // Count of groups (represents documents)
                            mStatusData.notInVatr.total += fDiffAmount; // Sum of aggregated DiffGrossAmount
                        }
                        // Mismatched Documents: Status = "E" (Error)
                        else if (sStatus === "E") {
                            mStatusData.mismatched.count++; // Count of groups (represents documents)
                            mStatusData.mismatched.total += fDiffAmount; // Sum of aggregated DiffGrossAmount
                        }
                    });

                    const oViewModel = this.getView().getModel("view");
                    if (oViewModel) {
                        oViewModel.setProperty("/reconciliationDetail/statusCards", mStatusData);
                    }
                }
            } catch (oError) {
                console.error("Error loading status card data:", oError);
            }
        },

        /**
         * Handler for before rebind table
         */
        onBeforeRebind: function(oEvent) {
            const mBindingParams = oEvent.getParameter("bindingParams");
            // Add any additional filters if needed
        },

        /**
         * Handler for close button - navigate back to main view
         */
        onCloseDetail: function() {
            this.getRouter().navTo("RouteMain");
        },

        /**
         * Factory method for creating donut chart segments (placeholder)
         */
        createDonutSegments: function(sId, oContext) {
            // Placeholder - to be implemented
            return null;
        },

        /**
         * Factory method for creating bar chart bars (placeholder)
         */
        createBars: function(sId, oContext) {
            // Placeholder - to be implemented
            return null;
        },

        /**
         * Factory method for creating line chart points (placeholder)
         */
        createPoints: function(sId, oContext) {
            // Placeholder - to be implemented
            return null;
        },

        /**
         * Handler for donut chart selection changed - filters table by selected status
         */
        onDonutChartSelectionChanged: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get selected segments from the event
            // selectionChanged event provides selectedSegments parameter (array)
            const aSelectedSegments = oEvent.getParameter("selectedSegments") || [];
            
            // Map each selected segment to its status filter
            const aSelectedStatusFilters = [];
            
            aSelectedSegments.forEach(function(oSegment) {
                // Get the status from the segment's binding context
                const oBindingContext = oSegment.getBindingContext("view");
                if (!oBindingContext) {
                    return;
                }

                const oSegmentData = oBindingContext.getObject();
                const sStatus = oSegmentData.status;

                // Map status to filter value
                let sStatusFilter = null;
                if (sStatus === "NE") {
                    sStatusFilter = "NOT_IN_ECSL";
                } else if (sStatus === "NV") {
                    sStatusFilter = "NOT_IN_VATR";
                } else if (sStatus === "E") {
                    // Error status - filter by Status = "E"
                    sStatusFilter = "ERROR";
                } else if (sStatus === "S") {
                    // Reconciled - filter by status starting with "S"
                    sStatusFilter = "RECONCILED";
                }
                
                if (sStatusFilter) {
                    aSelectedStatusFilters.push(sStatusFilter);
                }
            });

            // Update view model with selected status filters (empty array if none selected)
            oViewModel.setProperty("/reconciliationDetail/selectedStatusFilters", aSelectedStatusFilters);

            // Update card styling for all status cards
            const aStatusCards = [
                { id: "notInEcslCard", filter: "NOT_IN_ECSL" },
                { id: "notInVatrCard", filter: "NOT_IN_VATR" }
            ];

            aStatusCards.forEach(function(oCardInfo) {
                const oStatusCard = this.byId(oCardInfo.id);
                if (oStatusCard) {
                    if (aSelectedStatusFilters.indexOf(oCardInfo.filter) !== -1) {
                        oStatusCard.addStyleClass("statusCardActive");
                    } else {
                        oStatusCard.removeStyleClass("statusCardActive");
                    }
                }
            }.bind(this));

            // Update total difference card styling based on filter
            const oTotalDiffCard = this.byId("totalDifferenceCard");
            if (oTotalDiffCard) {
                if (aSelectedStatusFilters.indexOf("ALL_DIFFERENCES") !== -1) {
                    oTotalDiffCard.addStyleClass("totalDifferenceCardActive");
                    oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
                } else {
                    oTotalDiffCard.removeStyleClass("totalDifferenceCardActive");
                    oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
                }
            }

            // Trigger rebind
            oSmartTable.rebindTable();
        },

        /**
         * Handler for document type bar chart selection (placeholder)
         */
        onSelectDocumentTypeFilter: function(oEvent) {
            // Placeholder - to be implemented
        },

        /**
         * Handler for submitted month line chart selection (placeholder)
         */
        onSelectSubmittedMonthFilter: function(oEvent) {
            // Placeholder - to be implemented
        },


        /**
         * Populate reconciliation details tokenizers
         */
        _populateReconciliationDetails: function() {
            const oBindingContext = this.getView().getBindingContext();
            if (!oBindingContext) {
                return;
            }
            
            const oReconciliation = oBindingContext.getObject();
            if (!oReconciliation) {
                return;
            }

            // Get tokenizers
            const oCountryTokenizer = this.byId("reconciliationCountryListTokenizer");
            const oCompanyCodeTokenizer = this.byId("reconciliationCompanyCodeListTokenizer");

            // Populate country list tokenizer
            if (oCountryTokenizer && oReconciliation.CountryList) {
                oCountryTokenizer.removeAllTokens();
                const aCountryTokens = this.formatter.formatCountryListToTokens(oReconciliation.CountryList);
                aCountryTokens.forEach((oToken) => {
                    oCountryTokenizer.addToken(oToken);
                });
            }

            // Populate company code list tokenizer
            if (oCompanyCodeTokenizer && oReconciliation.CompanyCodeList) {
                oCompanyCodeTokenizer.removeAllTokens();
                const aCompanyCodeTokens = this.formatter.formatCompanyCodeListToTokens(oReconciliation.CompanyCodeList);
                aCompanyCodeTokens.forEach((oToken) => {
                    oCompanyCodeTokenizer.addToken(oToken);
                });
            }
        },

        /**
         * Handler for total difference card press - toggles filter to show only records with differences
         */
        onTotalDifferenceCardPress: function() {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            const oCard = this.byId("totalDifferenceCard");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get currently selected status filters
            const aCurrentFilters = oViewModel.getProperty("/reconciliationDetail/selectedStatusFilters") || [];
            
            // Toggle: if ALL_DIFFERENCES is already selected, remove it; otherwise add it
            const aNewFilters = aCurrentFilters.slice(); // Copy array
            const iIndex = aNewFilters.indexOf("ALL_DIFFERENCES");
            if (iIndex !== -1) {
                aNewFilters.splice(iIndex, 1);
            } else {
                // Remove any other status filters when selecting ALL_DIFFERENCES
                // (since ALL_DIFFERENCES means Status != "S", it's mutually exclusive)
                aNewFilters.length = 0;
                aNewFilters.push("ALL_DIFFERENCES");
            }
            oViewModel.setProperty("/reconciliationDetail/selectedStatusFilters", aNewFilters);
            oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);

            // Update card styling based on state
            if (oCard) {
                if (aNewFilters.indexOf("ALL_DIFFERENCES") !== -1) {
                    oCard.addStyleClass("totalDifferenceCardActive");
                } else {
                    oCard.removeStyleClass("totalDifferenceCardActive");
                }
            }

            // Update status card active states based on selected filters
            const aStatusCards = [
                { id: "notInEcslCard", filter: "NOT_IN_ECSL" },
                { id: "notInVatrCard", filter: "NOT_IN_VATR" }
            ];

            aStatusCards.forEach(function(oCardInfo) {
                const oStatusCard = this.byId(oCardInfo.id);
                if (oStatusCard) {
                    if (aNewFilters.indexOf(oCardInfo.filter) !== -1) {
                        oStatusCard.addStyleClass("statusCardActive");
                    } else {
                        oStatusCard.removeStyleClass("statusCardActive");
                    }
                }
            }.bind(this));

            // Trigger rebind on SmartTable - this will call onBeforeRebindDocumentsTable
            // which will apply the filter based on the selectedStatusFilter
            oSmartTable.rebindTable();
        },

        /**
         * Handler for status card press - filters table by status
         */
        onStatusCardPress: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            const oCard = oEvent.getSource();
            
            if (!oSmartTable || !oViewModel || !oCard) {
                return;
            }

            // Get the status filter from custom data
            const oCustomData = oCard.getCustomData();
            let sStatusFilter = null;
            if (oCustomData && oCustomData.length > 0) {
                const oStatusData = oCustomData.find(function(oData) {
                    return oData.getKey() === "statusFilter";
                });
                if (oStatusData) {
                    sStatusFilter = oStatusData.getValue();
                }
            }

            // Get currently selected status filters
            const aCurrentFilters = oViewModel.getProperty("/reconciliationDetail/selectedStatusFilters") || [];
            
            // Toggle: if the filter is already selected, remove it; otherwise add it
            const aNewFilters = aCurrentFilters.slice(); // Copy array
            const iIndex = aNewFilters.indexOf(sStatusFilter);
            if (iIndex !== -1) {
                aNewFilters.splice(iIndex, 1);
            } else {
                aNewFilters.push(sStatusFilter);
            }
            oViewModel.setProperty("/reconciliationDetail/selectedStatusFilters", aNewFilters);

            // Update card styling for all status cards
            const aStatusCards = [
                { id: "notInEcslCard", filter: "NOT_IN_ECSL" },
                { id: "notInVatrCard", filter: "NOT_IN_VATR" }
            ];

            aStatusCards.forEach(function(oCardInfo) {
                const oStatusCard = this.byId(oCardInfo.id);
                if (oStatusCard) {
                    if (aNewFilters.indexOf(oCardInfo.filter) !== -1) {
                        oStatusCard.addStyleClass("statusCardActive");
                    } else {
                        oStatusCard.removeStyleClass("statusCardActive");
                    }
                }
            }.bind(this));

            // Update total difference card styling based on filter
            const oTotalDiffCard = this.byId("totalDifferenceCard");
            if (oTotalDiffCard) {
                if (aNewFilters.indexOf("ALL_DIFFERENCES") !== -1) {
                    oTotalDiffCard.addStyleClass("totalDifferenceCardActive");
                    oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
                } else {
                    oTotalDiffCard.removeStyleClass("totalDifferenceCardActive");
                    oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
                }
            }

            // Trigger rebind
            oSmartTable.rebindTable();
        }

    });

    return ReconciliationDetailController;
});

