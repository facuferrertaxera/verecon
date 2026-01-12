sap.ui.define([
    "tech/taxera/taxreporting/verecon/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "tech/taxera/taxreporting/verecon/utils/formatter",
    "tech/taxera/taxreporting/verecon/utils/types"
], (BaseController, Filter, FilterOperator, JSONModel, formatter, types) => {
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
                    selectedCountry: "",
                    bChartShowError: false,
                    headerFilters: {
                        statusDonutChart: {
                            segments: []
                        },
                        documentTypeBarChart: {
                            bars: []
                        },
                        submissionDateLineChart: {
                            points: []
                        }
                    },
                    totalDifference: {
                        value: 0,
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
                    selectedStatusFilter: null,
                    showOnlyDifferences: false
                }
            });
            this.getView().setModel(oViewModel, "view");

            // Initialize country and company code maps for formatter
            this._mCountryMap = {};
            this._mCompanyCodeMap = {};

            // Set controller reference in formatter
            formatter.setController(this);

            // Load country and company code maps
            this._loadAvailableCountries();
            this._loadAvailableCompanyCodes();

            // Get router and attach route matched handler
            const oRouter = this.getRouter();
            if (oRouter) {
                oRouter.getRoute("ReconciliationDetail").attachPatternMatched(this._onRouteMatched, this);
            }
        },

        /**
         * Handler for route matched - loads reconciliation data
         */
        _onRouteMatched: function(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sReconId = oArgs.reconId;
            
            if (!sReconId) {
                return;
            }

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
                        this._loadTotalDifference(sReconciliationPath);
                        this._loadDonutChartData(sReconciliationPath);
                        this._loadStatusCardData(sReconciliationPath);
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
         * Store reconciliation path for SmartTable binding
         */
        _sReconciliationPath: null,

        /**
         * Handler for SmartTable beforeRebindTable event
         * Sets up the binding path to the navigation property and applies filters
         */
        onBeforeRebindDocumentsTable: function(oEvent) {
            const oBindingParams = oEvent.getParameter("bindingParams");
            
            if (this._sReconciliationPath) {
                // Set the binding path to the navigation property
                oBindingParams.path = `${this._sReconciliationPath}/to_Document`;
            }
            
            // Get existing filters or initialize empty array
            let aFilters = oBindingParams.filters || [];
            
            // Get filter flags from view model
            const oViewModel = this.getView().getModel("view");
            const bShowOnlyDifferences = oViewModel ? oViewModel.getProperty("/reconciliationDetail/showOnlyDifferences") : false;
            const sSelectedStatusFilter = oViewModel ? oViewModel.getProperty("/reconciliationDetail/selectedStatusFilter") : null;
            
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
            
            // Add status filter if a status card is selected
            if (sSelectedStatusFilter) {
                if (sSelectedStatusFilter === "NOT_IN_ECSL") {
                    // Not in EC Sales List: Status = "NE"
                    const oStatusFilter = new Filter("Status", FilterOperator.EQ, "NE");
                    aFilters.push(oStatusFilter);
                } else if (sSelectedStatusFilter === "NOT_IN_VATR") {
                    // Not in VAT Return: Status = "NV"
                    const oStatusFilter = new Filter("Status", FilterOperator.EQ, "NV");
                    aFilters.push(oStatusFilter);
                } else if (sSelectedStatusFilter === "MISMATCHED") {
                    // Mismatched Documents: Status = "E" (Error)
                    const oStatusFilter = new Filter("Status", FilterOperator.EQ, "E");
                    aFilters.push(oStatusFilter);
                } else if (sSelectedStatusFilter === "RECONCILED") {
                    // Reconciled: Status starts with "S" - create OR filter for common S statuses
                    const aSStatusFilters = ["S", "SR", "SV", "ST", "SX", "SS"].map(function(sStatus) {
                        return new Filter("Status", FilterOperator.EQ, sStatus);
                    });
                    aFilters.push(new Filter({
                        filters: aSStatusFilters,
                        and: false
                    }));
                }
            }
            
            // Set the filters
            oBindingParams.filters = aFilters;
            
            // Add event handlers
            oBindingParams.events = {
                dataRequested: () => {
                    this.getView().setBusy(true);
                },
                dataReceived: (oEvent) => {
                    this.getView().setBusy(false);
                }
            };
        },

        /**
         * Bind the documents SmartTable to the navigation property
         */
        _bindDocumentsTable: function(sReconciliationPath) {
            // Store the path for use in onBeforeRebindDocumentsTable
            this._sReconciliationPath = sReconciliationPath;
            
            // Trigger rebind on the SmartTable
            const oSmartTable = this.byId("documentsSmartTable");
            if (oSmartTable) {
                oSmartTable.rebindTable();
            }
        },

        /**
         * Load total difference from the full unfiltered dataset
         * This should only be called once when route is matched
         */
        _loadTotalDifference: function(sReconciliationPath) {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read all documents without any filters to calculate total difference
            oModel.read(`${sReconciliationPath}/to_Document`, {
                urlParameters: {
                    "$select": "DiffGrossAmount"
                },
                success: (oResponse) => {
                    if (oResponse && oResponse.results) {
                        let fTotalDifference = 0;
                        oResponse.results.forEach((oDocument) => {
                            if (oDocument) {
                                // Use absolute value for total difference
                                fTotalDifference += Math.abs(oDocument.DiffGrossAmount || 0);
                            }
                        });
                        
                        const oViewModel = this.getView().getModel("view");
                        if (oViewModel) {
                            oViewModel.setProperty("/reconciliationDetail/totalDifference/value", fTotalDifference);
                        }
                    }
                },
                error: (oError) => {
                    console.error("Error loading total difference:", oError);
                }
            });
        },

        /**
         * Load donut chart data from the full unfiltered dataset
         * This should only be called once when route is matched
         */
        _loadDonutChartData: function(sReconciliationPath) {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read all documents without any filters to calculate donut chart data
            oModel.read(`${sReconciliationPath}/to_Document`, {
                urlParameters: {
                    "$select": "Status,StatusText"
                },
                success: (oResponse) => {
                    if (oResponse && oResponse.results) {
                        const mStatusCounts = {
                            "S": 0,  // Reconciled
                            "NE": 0, // Not in ECSL
                            "NV": 0, // Not in VAT Return
                            "E": 0   // Error
                        };

                        // Count documents by status
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
                                label: "Error",
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
                },
                error: (oError) => {
                    console.error("Error loading donut chart data:", oError);
                }
            });
        },

        /**
         * Load status card data from the full unfiltered dataset
         * This should only be called once when route is matched
         */
        _loadStatusCardData: function(sReconciliationPath) {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            // Read all documents without any filters to calculate status card data
            oModel.read(`${sReconciliationPath}/to_Document`, {
                urlParameters: {
                    "$select": "Status,StatusText,DiffGrossAmount"
                },
                success: (oResponse) => {
                    if (oResponse && oResponse.results) {
                        const mStatusData = {
                            notInEcsl: { count: 0, total: 0 },
                            notInVatr: { count: 0, total: 0 },
                            mismatched: { count: 0, total: 0 }
                        };

                        oResponse.results.forEach((oDocument) => {
                            if (!oDocument) {
                                return;
                            }

                            const fDiffAmount = oDocument.DiffGrossAmount || 0;
                            const sStatus = oDocument.Status || "";

                            // Not in EC Sales List: Status = "NE"
                            if (sStatus === "NE") {
                                mStatusData.notInEcsl.count++;
                                mStatusData.notInEcsl.total += fDiffAmount;
                            }
                            // Not in VAT Return: Status = "NV"
                            else if (sStatus === "NV") {
                                mStatusData.notInVatr.count++;
                                mStatusData.notInVatr.total += fDiffAmount;
                            }
                            // Mismatched Documents: Status = "E" (Error)
                            else if (sStatus === "E") {
                                mStatusData.mismatched.count++;
                                mStatusData.mismatched.total += fDiffAmount;
                            }
                        });

                        const oViewModel = this.getView().getModel("view");
                        if (oViewModel) {
                            oViewModel.setProperty("/reconciliationDetail/statusCards", mStatusData);
                        }
                    }
                },
                error: (oError) => {
                    console.error("Error loading status card data:", oError);
                }
            });
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
         * Handler for donut chart press - filters table by selected status
         */
        onDonutChartPress: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get selected segment from the event
            const oSegment = oEvent.getParameter("segment");
            if (!oSegment) {
                return;
            }

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
                sStatusFilter = "MISMATCHED";
            } else if (sStatus === "S") {
                // Reconciled - filter by status starting with "S"
                sStatusFilter = "RECONCILED";
            }

            // Get currently selected status filter
            const sCurrentFilter = oViewModel.getProperty("/reconciliationDetail/selectedStatusFilter");
            
            // Toggle: if clicking the same status, deselect it; otherwise select the new one
            const sNewFilter = sCurrentFilter === sStatusFilter ? null : sStatusFilter;
            oViewModel.setProperty("/reconciliationDetail/selectedStatusFilter", sNewFilter);

            // Update card styling for all status cards
            const aStatusCards = [
                { id: "notInEcslCard", filter: "NOT_IN_ECSL" },
                { id: "notInVatrCard", filter: "NOT_IN_VATR" },
                { id: "mismatchedCard", filter: "MISMATCHED" }
            ];

            aStatusCards.forEach(function(oCardInfo) {
                const oStatusCard = this.byId(oCardInfo.id);
                if (oStatusCard) {
                    if (sNewFilter === oCardInfo.filter) {
                        oStatusCard.addStyleClass("statusCardActive");
                    } else {
                        oStatusCard.removeStyleClass("statusCardActive");
                    }
                }
            }.bind(this));

            // Clear total difference card active state when status filter is applied
            const oTotalDiffCard = this.byId("totalDifferenceCard");
            if (oTotalDiffCard && sNewFilter) {
                oTotalDiffCard.removeStyleClass("totalDifferenceCardActive");
                oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
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
         * Load available countries from Country entity set
         */
        _loadAvailableCountries: function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            oModel.read("/Country", {
                urlParameters: {
                    "$select": "Country,Country_Text,CountryName"
                },
                success: (oResponse) => {
                    const aResults = oResponse.results || [];
                    this._mCountryMap = {};
                    aResults.forEach((oCountry) => {
                        this._mCountryMap[oCountry.Country] = oCountry.Country_Text || oCountry.CountryName || oCountry.Country;
                    });
                },
                error: (oError) => {
                    console.error("[_loadAvailableCountries] Error loading countries:", oError);
                    this._mCountryMap = {};
                }
            });
        },

        /**
         * Load available company codes from CompanyVH entity set
         */
        _loadAvailableCompanyCodes: function() {
            const oModel = this.getModel();
            if (!oModel) {
                return;
            }

            oModel.read("/CompanyVH", {
                urlParameters: {
                    "$select": "CompanyCode,Name"
                },
                success: (oResponse) => {
                    const aResults = oResponse.results || [];
                    this._mCompanyCodeMap = {};
                    aResults.forEach((oCompany) => {
                        this._mCompanyCodeMap[oCompany.CompanyCode] = oCompany.Name || oCompany.CompanyCode;
                    });
                },
                error: (oError) => {
                    console.error("[_loadAvailableCompanyCodes] Error loading company codes:", oError);
                    this._mCompanyCodeMap = {};
                }
            });
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

            // Toggle the filter state
            const bShowOnlyDifferences = !oViewModel.getProperty("/reconciliationDetail/showOnlyDifferences");
            oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", bShowOnlyDifferences);

            // Update card styling based on state
            if (oCard) {
                if (bShowOnlyDifferences) {
                    oCard.addStyleClass("totalDifferenceCardActive");
                } else {
                    oCard.removeStyleClass("totalDifferenceCardActive");
                }
            }

            // Trigger rebind on SmartTable - this will call onBeforeRebindDocumentsTable
            // which will apply the filter based on the showOnlyDifferences flag
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

            // Get currently selected status filter
            const sCurrentFilter = oViewModel.getProperty("/reconciliationDetail/selectedStatusFilter");
            
            // Toggle: if clicking the same card, deselect it; otherwise select the new one
            const sNewFilter = sCurrentFilter === sStatusFilter ? null : sStatusFilter;
            oViewModel.setProperty("/reconciliationDetail/selectedStatusFilter", sNewFilter);

            // Update card styling for all status cards
            const aStatusCards = [
                { id: "notInEcslCard", filter: "NOT_IN_ECSL" },
                { id: "notInVatrCard", filter: "NOT_IN_VATR" },
                { id: "mismatchedCard", filter: "MISMATCHED" }
            ];

            aStatusCards.forEach(function(oCardInfo) {
                const oStatusCard = this.byId(oCardInfo.id);
                if (oStatusCard) {
                    if (sNewFilter === oCardInfo.filter) {
                        oStatusCard.addStyleClass("statusCardActive");
                    } else {
                        oStatusCard.removeStyleClass("statusCardActive");
                    }
                }
            }.bind(this));

            // Clear total difference card active state when status filter is applied
            const oTotalDiffCard = this.byId("totalDifferenceCard");
            if (oTotalDiffCard && sNewFilter) {
                oTotalDiffCard.removeStyleClass("totalDifferenceCardActive");
                oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", false);
            }

            // Trigger rebind
            oSmartTable.rebindTable();
        }

    });

    return ReconciliationDetailController;
});

