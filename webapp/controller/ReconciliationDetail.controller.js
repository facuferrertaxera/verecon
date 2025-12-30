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
                    treemapData: {
                        companyCodes: [],
                        taxCodes: []
                    },
                    totalDifference: {
                        value: 0,
                        scale: "EUR",
                        text: "Total Difference"
                    },
                    showOnlyDifferences: false,
                    selectedCompanyCodes: [],
                    selectedTaxCodes: []
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

            // Initialize treemap data with mock data
            this._setMockTreemapData();

            // Get router and attach route matched handler
            const oRouter = this.getRouter();
            if (oRouter) {
                oRouter.getRoute("ReconciliationDetail").attachPatternMatched(this._onRouteMatched, this);
            }

            // Configure VizFrames after view is rendered
            this.getView().addEventDelegate({
                onAfterRendering: () => {
                    this._configureTreemaps();
                }
            }, this);
        },

        /**
         * Configure treemap VizFrames to hide titles and format currency
         */
        _configureTreemaps: function() {
            const oCompanyCodeTreemap = this.byId("companyCodeTreemap");
            const oTaxCodeTreemap = this.byId("taxCodeTreemap");

            if (oCompanyCodeTreemap) {
                oCompanyCodeTreemap.setVizProperties({
                    plotArea: {
                        dataLabel: {
                            visible: true,
                            formatString: "#,##0.00 EUR"
                        }
                    },
                    title: {
                        visible: false
                    },
                    valueAxis: {
                        label: {
                            formatString: "#,##0.00 EUR"
                        }
                    }
                });
                
                // Add click handlers for company code treemap (both select and deselect)
                oCompanyCodeTreemap.attachSelectData(this.onCompanyCodeTreemapSelect.bind(this));
                oCompanyCodeTreemap.attachDeselectData(this.onCompanyCodeTreemapDeselect.bind(this));
            }

            if (oTaxCodeTreemap) {
                oTaxCodeTreemap.setVizProperties({
                    plotArea: {
                        dataLabel: {
                            visible: true,
                            formatString: "#,##0.00 EUR"
                        }
                    },
                    title: {
                        visible: false
                    },
                    valueAxis: {
                        label: {
                            formatString: "#,##0.00 EUR"
                        }
                    }
                });
                
                // Add click handlers for tax code treemap (both select and deselect)
                oTaxCodeTreemap.attachSelectData(this.onTaxCodeTreemapSelect.bind(this));
                oTaxCodeTreemap.attachDeselectData(this.onTaxCodeTreemapDeselect.bind(this));
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
                        
                        // After reconciliation is loaded, bind the SmartTable and load treemap data
                        this._bindDocumentsTable(sReconciliationPath);
                        
                        // Load treemap data once from the full unfiltered dataset
                        this._loadTreemapDataOnce(sReconciliationPath);
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
            const aSelectedCompanyCodes = oViewModel ? (oViewModel.getProperty("/reconciliationDetail/selectedCompanyCodes") || []) : [];
            const aSelectedTaxCodes = oViewModel ? (oViewModel.getProperty("/reconciliationDetail/selectedTaxCodes") || []) : [];
            
            // Remove any existing custom filters (DiffGrossAmount, CompanyCode, TaxCode)
            aFilters = aFilters.filter(function(oFilter) {
                // Check if this is one of our custom filters
                if (oFilter.sPath === "DiffGrossAmount" || oFilter.sPath === "CompanyCode" || oFilter.sPath === "TaxCode") {
                    return false;
                }
                // Check if it's a composite filter containing our custom filters
                if (oFilter.aFilters && Array.isArray(oFilter.aFilters)) {
                    const bContainsCustomFilter = oFilter.aFilters.some(function(oSubFilter) {
                        return oSubFilter.sPath === "DiffGrossAmount" || 
                               oSubFilter.sPath === "CompanyCode" || 
                               oSubFilter.sPath === "TaxCode";
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
            
            // Add CompanyCode filter if any are selected (IN filter for multiple values)
            if (aSelectedCompanyCodes.length > 0) {
                const aCompanyCodeFilters = aSelectedCompanyCodes.map(function(sCompanyCode) {
                    return new Filter("CompanyCode", FilterOperator.EQ, sCompanyCode);
                });
                if (aCompanyCodeFilters.length === 1) {
                    aFilters.push(aCompanyCodeFilters[0]);
                } else if (aCompanyCodeFilters.length > 1) {
                    // Multiple company codes - use OR filter
                    aFilters.push(new Filter({
                        filters: aCompanyCodeFilters,
                        and: false
                    }));
                }
            }
            
            // Add TaxCode filter if any are selected (IN filter for multiple values)
            if (aSelectedTaxCodes.length > 0) {
                const aTaxCodeFilters = aSelectedTaxCodes.map(function(sTaxCode) {
                    return new Filter("TaxCode", FilterOperator.EQ, sTaxCode);
                });
                if (aTaxCodeFilters.length === 1) {
                    aFilters.push(aTaxCodeFilters[0]);
                } else if (aTaxCodeFilters.length > 1) {
                    // Multiple tax codes - use OR filter
                    aFilters.push(new Filter({
                        filters: aTaxCodeFilters,
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
                    // Don't recalculate treemap data here - it should only be loaded once on route matched
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
         * Load treemap data once from the full unfiltered dataset
         * This should only be called once when route is matched
         */
        _loadTreemapDataOnce: async function(sReconciliationPath) {
            try {
                // Read all documents without any filters to populate treemaps
                const oResponse = await this.promRead(`${sReconciliationPath}/to_Document`, {
                    urlParameters: {
                        "$select": "CompanyCode,TaxCode,DiffGrossAmount"
                    }
                });
                
                if (oResponse && oResponse.results) {
                    this._populateTreemapDataFromResults(oResponse.results);
                } else {
                    // Fallback to mock data
                    this._setMockTreemapData();
                }
            } catch (oError) {
                console.error("Error loading treemap data:", oError);
                // Fallback to mock data
                this._setMockTreemapData();
            }
        },

        /**
         * Populate treemap data from results array (used for initial load)
         */
        _populateTreemapDataFromResults: function(aResults) {
            const mCompanyCodeAggregation = {};
            const mTaxCodeAggregation = {};
            let fTotalDifference = 0;

            // Aggregate by CompanyCode and TaxCode
            aResults.forEach((oDocument) => {
                if (!oDocument) {
                    return;
                }

                const sCompanyCode = oDocument.CompanyCode || "Unknown";
                const sTaxCode = oDocument.TaxCode || "Unknown";
                const fDiffAmount = Math.abs(oDocument.DiffGrossAmount || 0);
                
                // Sum total difference (use absolute value for total)
                fTotalDifference += fDiffAmount;

                // Aggregate by CompanyCode
                if (!mCompanyCodeAggregation[sCompanyCode]) {
                    mCompanyCodeAggregation[sCompanyCode] = {
                        CompanyCode: sCompanyCode,
                        DiffGrossAmount: 0,
                        Currency: "EUR"
                    };
                }
                mCompanyCodeAggregation[sCompanyCode].DiffGrossAmount += fDiffAmount;

                // Aggregate by TaxCode
                if (!mTaxCodeAggregation[sTaxCode]) {
                    mTaxCodeAggregation[sTaxCode] = {
                        TaxCode: sTaxCode,
                        DiffGrossAmount: 0,
                        Currency: "EUR"
                    };
                }
                mTaxCodeAggregation[sTaxCode].DiffGrossAmount += fDiffAmount;
            });

            // Convert to arrays and update view model
            const aCompanyCodes = Object.values(mCompanyCodeAggregation);
            const aTaxCodes = Object.values(mTaxCodeAggregation);

            // If no data, use mock data for demonstration
            if (aCompanyCodes.length === 0 && aTaxCodes.length === 0) {
                this._setMockTreemapData();
                return;
            }

            const oViewModel = this.getView().getModel("view");
            if (oViewModel) {
                oViewModel.setProperty("/reconciliationDetail/treemapData/companyCodes", aCompanyCodes);
                oViewModel.setProperty("/reconciliationDetail/treemapData/taxCodes", aTaxCodes);
                
                // Update total difference
                oViewModel.setProperty("/reconciliationDetail/totalDifference/value", fTotalDifference);
            }
        },

        /**
         * Aggregate document data for treemap visualizations
         */
        _populateTreemapData: function() {
            const oTable = this.byId("documentsTable");
            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                // If no binding yet, use mock data
                this._setMockTreemapData();
                return;
            }

            const aContexts = oBinding.getContexts();
            const mCompanyCodeAggregation = {};
            const mTaxCodeAggregation = {};
            let fTotalDifference = 0;

            // Aggregate by CompanyCode and TaxCode
            aContexts.forEach((oContext) => {
                if (oContext) {
                    const oDocument = oContext.getObject();
                    if (!oDocument) {
                        return;
                    }

                    const sCompanyCode = oDocument.CompanyCode || "Unknown";
                    const sTaxCode = oDocument.TaxCode || "Unknown";
                    const fDiffAmount = Math.abs(oDocument.DiffGrossAmount || 0);
                    
                    // Sum total difference (use absolute value for total)
                    fTotalDifference += fDiffAmount;

                    // Aggregate by CompanyCode
                    if (!mCompanyCodeAggregation[sCompanyCode]) {
                        mCompanyCodeAggregation[sCompanyCode] = {
                            CompanyCode: sCompanyCode,
                            DiffGrossAmount: 0,
                            Currency: "EUR"
                        };
                    }
                    mCompanyCodeAggregation[sCompanyCode].DiffGrossAmount += fDiffAmount;

                    // Aggregate by TaxCode
                    if (!mTaxCodeAggregation[sTaxCode]) {
                        mTaxCodeAggregation[sTaxCode] = {
                            TaxCode: sTaxCode,
                            DiffGrossAmount: 0,
                            Currency: "EUR"
                        };
                    }
                    mTaxCodeAggregation[sTaxCode].DiffGrossAmount += fDiffAmount;
                }
            });

            // Convert to arrays and update view model
            const aCompanyCodes = Object.values(mCompanyCodeAggregation);
            const aTaxCodes = Object.values(mTaxCodeAggregation);

            // If no data, use mock data for demonstration
            if (aCompanyCodes.length === 0 && aTaxCodes.length === 0) {
                this._setMockTreemapData();
                return;
            }

            const oViewModel = this.getView().getModel("view");
            if (oViewModel) {
                oViewModel.setProperty("/reconciliationDetail/treemapData/companyCodes", aCompanyCodes);
                oViewModel.setProperty("/reconciliationDetail/treemapData/taxCodes", aTaxCodes);
                
                // Update total difference
                oViewModel.setProperty("/reconciliationDetail/totalDifference/value", fTotalDifference);
            }
        },

        /**
         * Set mock data for treemap visualizations
         */
        _setMockTreemapData: function() {
            const aCompanyCodes = [
                { CompanyCode: "TXNO", DiffGrossAmount: 15000, Currency: "EUR" },
                { CompanyCode: "TXDE", DiffGrossAmount: 12000, Currency: "EUR" },
                { CompanyCode: "TXFR", DiffGrossAmount: 9500, Currency: "EUR" },
                { CompanyCode: "TXSE", DiffGrossAmount: 8500, Currency: "EUR" },
                { CompanyCode: "TXIT", DiffGrossAmount: 11000, Currency: "EUR" },
                { CompanyCode: "TXES", DiffGrossAmount: 7200, Currency: "EUR" },
                { CompanyCode: "TXNL", DiffGrossAmount: 6800, Currency: "EUR" }
            ];

            const aTaxCodes = [
                { TaxCode: "A1", DiffGrossAmount: 8000, Currency: "EUR" },
                { TaxCode: "B2", DiffGrossAmount: 12000, Currency: "EUR" },
                { TaxCode: "C3", DiffGrossAmount: 6500, Currency: "EUR" },
                { TaxCode: "D4", DiffGrossAmount: 11000, Currency: "EUR" },
                { TaxCode: "E5", DiffGrossAmount: 4500, Currency: "EUR" },
                { TaxCode: "F6", DiffGrossAmount: 9500, Currency: "EUR" },
                { TaxCode: "G7", DiffGrossAmount: 7800, Currency: "EUR" },
                { TaxCode: "H8", DiffGrossAmount: 6200, Currency: "EUR" },
                { TaxCode: "I9", DiffGrossAmount: 10500, Currency: "EUR" },
                { TaxCode: "J10", DiffGrossAmount: 8800, Currency: "EUR" },
                { TaxCode: "K11", DiffGrossAmount: 5400, Currency: "EUR" },
                { TaxCode: "L12", DiffGrossAmount: 11200, Currency: "EUR" },
                { TaxCode: "M13", DiffGrossAmount: 6900, Currency: "EUR" },
                { TaxCode: "N14", DiffGrossAmount: 5100, Currency: "EUR" }
            ];

            // Calculate total difference from company codes (sum of all differences)
            const fTotalDifference = aCompanyCodes.reduce((fSum, oItem) => fSum + (oItem.DiffGrossAmount || 0), 0);

            const oViewModel = this.getView().getModel("view");
            if (oViewModel) {
                oViewModel.setProperty("/reconciliationDetail/treemapData/companyCodes", aCompanyCodes);
                oViewModel.setProperty("/reconciliationDetail/treemapData/taxCodes", aTaxCodes);
                oViewModel.setProperty("/reconciliationDetail/totalDifference/value", fTotalDifference);
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
         * Handler for status donut chart selection (placeholder)
         */
        onSelectStatus: function(oEvent) {
            // Placeholder - to be implemented
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
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Toggle the filter state
            const bShowOnlyDifferences = !oViewModel.getProperty("/reconciliationDetail/showOnlyDifferences");
            oViewModel.setProperty("/reconciliationDetail/showOnlyDifferences", bShowOnlyDifferences);

            // Trigger rebind on SmartTable - this will call onBeforeRebindDocumentsTable
            // which will apply the filter based on the showOnlyDifferences flag
            oSmartTable.rebindTable();
        },

        /**
         * Handler for company code treemap selection - filters table by company code
         */
        onCompanyCodeTreemapSelect: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get selected data from treemap
            const aSelectedData = oEvent.getParameter("data") || [];
            
            // Get currently selected company codes from view model
            const aCurrentCompanyCodes = oViewModel.getProperty("/reconciliationDetail/selectedCompanyCodes") || [];
            let aNewCompanyCodes = [...aCurrentCompanyCodes];
            
            // Process selected items - extract CompanyCode from each data point
            aSelectedData.forEach(function(oDataPoint) {
                if (oDataPoint && oDataPoint.data) {
                    // For treemap, the dimension value (CompanyCode) is in the data
                    const sCompanyCode = oDataPoint.data.CompanyCode || oDataPoint.data[0]?.CompanyCode;
                    if (sCompanyCode && aNewCompanyCodes.indexOf(sCompanyCode) === -1) {
                        aNewCompanyCodes.push(sCompanyCode);
                    }
                }
            });
            
            // Update view model - store as array for multiple selections
            oViewModel.setProperty("/reconciliationDetail/selectedCompanyCodes", aNewCompanyCodes);
            
            // Clear tax code filter when company code is selected (mutually exclusive)
            if (aNewCompanyCodes.length > 0) {
                oViewModel.setProperty("/reconciliationDetail/selectedTaxCodes", []);
            }
            
            // Trigger rebind
            oSmartTable.rebindTable();
        },

        /**
         * Handler for company code treemap deselection - removes filter from table
         */
        onCompanyCodeTreemapDeselect: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get deselected data from treemap
            const aDeselectedData = oEvent.getParameter("data") || [];
            
            // Get currently selected company codes from view model
            const aCurrentCompanyCodes = oViewModel.getProperty("/reconciliationDetail/selectedCompanyCodes") || [];
            let aNewCompanyCodes = [...aCurrentCompanyCodes];
            
            // Process deselected items - remove from selection
            aDeselectedData.forEach(function(oDataPoint) {
                if (oDataPoint && oDataPoint.data) {
                    const sCompanyCode = oDataPoint.data.CompanyCode || oDataPoint.data[0]?.CompanyCode;
                    if (sCompanyCode) {
                        const iIndex = aNewCompanyCodes.indexOf(sCompanyCode);
                        if (iIndex > -1) {
                            aNewCompanyCodes.splice(iIndex, 1);
                        }
                    }
                }
            });
            
            // Update view model
            oViewModel.setProperty("/reconciliationDetail/selectedCompanyCodes", aNewCompanyCodes);
            
            // Trigger rebind
            oSmartTable.rebindTable();
        },

        /**
         * Handler for tax code treemap selection - filters table by tax code
         */
        onTaxCodeTreemapSelect: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get selected data from treemap
            const aSelectedData = oEvent.getParameter("data") || [];
            
            // Get currently selected tax codes from view model
            const aCurrentTaxCodes = oViewModel.getProperty("/reconciliationDetail/selectedTaxCodes") || [];
            let aNewTaxCodes = [...aCurrentTaxCodes];
            
            // Process selected items - extract TaxCode from each data point
            aSelectedData.forEach(function(oDataPoint) {
                if (oDataPoint && oDataPoint.data) {
                    // For treemap, the dimension value (TaxCode) is in the data
                    const sTaxCode = oDataPoint.data.TaxCode || oDataPoint.data[0]?.TaxCode;
                    if (sTaxCode && aNewTaxCodes.indexOf(sTaxCode) === -1) {
                        aNewTaxCodes.push(sTaxCode);
                    }
                }
            });
            
            // Update view model - store as array for multiple selections
            oViewModel.setProperty("/reconciliationDetail/selectedTaxCodes", aNewTaxCodes);
            
            // Clear company code filter when tax code is selected (mutually exclusive)
            if (aNewTaxCodes.length > 0) {
                oViewModel.setProperty("/reconciliationDetail/selectedCompanyCodes", []);
            }
            
            // Trigger rebind
            oSmartTable.rebindTable();
        },

        /**
         * Handler for tax code treemap deselection - removes filter from table
         */
        onTaxCodeTreemapDeselect: function(oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oSmartTable = this.byId("documentsSmartTable");
            
            if (!oSmartTable || !oViewModel) {
                return;
            }

            // Get deselected data from treemap
            const aDeselectedData = oEvent.getParameter("data") || [];
            
            // Get currently selected tax codes from view model
            const aCurrentTaxCodes = oViewModel.getProperty("/reconciliationDetail/selectedTaxCodes") || [];
            let aNewTaxCodes = [...aCurrentTaxCodes];
            
            // Process deselected items - remove from selection
            aDeselectedData.forEach(function(oDataPoint) {
                if (oDataPoint && oDataPoint.data) {
                    const sTaxCode = oDataPoint.data.TaxCode || oDataPoint.data[0]?.TaxCode;
                    if (sTaxCode) {
                        const iIndex = aNewTaxCodes.indexOf(sTaxCode);
                        if (iIndex > -1) {
                            aNewTaxCodes.splice(iIndex, 1);
                        }
                    }
                }
            });
            
            // Update view model
            oViewModel.setProperty("/reconciliationDetail/selectedTaxCodes", aNewTaxCodes);
            
            // Trigger rebind
            oSmartTable.rebindTable();
        }
    });

    return ReconciliationDetailController;
});

