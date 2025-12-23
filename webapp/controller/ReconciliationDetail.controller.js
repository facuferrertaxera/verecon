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
                    }
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
         * Configure treemap VizFrames to hide titles
         */
        _configureTreemaps: function() {
            const oCompanyCodeTreemap = this.byId("companyCodeTreemap");
            const oTaxCodeTreemap = this.byId("taxCodeTreemap");

            if (oCompanyCodeTreemap) {
                oCompanyCodeTreemap.setVizProperties({
                    plotArea: {
                        dataLabel: {
                            visible: true
                        }
                    },
                    title: {
                        visible: false
                    }
                });
            }

            if (oTaxCodeTreemap) {
                oTaxCodeTreemap.setVizProperties({
                    plotArea: {
                        dataLabel: {
                            visible: true
                        }
                    },
                    title: {
                        visible: false
                    }
                });
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
                        
                        // After reconciliation is loaded, bind the SmartTable
                        this._bindDocumentsTable(sReconciliationPath);
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
         * Bind the documents table to the navigation property
         */
        _bindDocumentsTable: function(sReconciliationPath) {
            const oTable = this.byId("documentsTable");
            
            if (oTable) {
                // Bind rows aggregation to the navigation property (to_Document is singular)
                oTable.bindRows({
                    path: `${sReconciliationPath}/to_Document`,
                    events: {
                        dataRequested: () => {
                            this.getView().setBusy(true);
                        },
                        dataReceived: (oEvent) => {
                            this.getView().setBusy(false);
                            // Aggregate documents for treemap visualizations
                            this._populateTreemapData();
                        }
                    }
                });
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

                    // Aggregate by CompanyCode
                    if (!mCompanyCodeAggregation[sCompanyCode]) {
                        mCompanyCodeAggregation[sCompanyCode] = {
                            CompanyCode: sCompanyCode,
                            DiffGrossAmount: 0
                        };
                    }
                    mCompanyCodeAggregation[sCompanyCode].DiffGrossAmount += fDiffAmount;

                    // Aggregate by TaxCode
                    if (!mTaxCodeAggregation[sTaxCode]) {
                        mTaxCodeAggregation[sTaxCode] = {
                            TaxCode: sTaxCode,
                            DiffGrossAmount: 0
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
            }
        },

        /**
         * Set mock data for treemap visualizations
         */
        _setMockTreemapData: function() {
            const aCompanyCodes = [
                { CompanyCode: "TXNO", DiffGrossAmount: 15000 },
                { CompanyCode: "TXDE", DiffGrossAmount: 12000 },
                { CompanyCode: "TXFR", DiffGrossAmount: 9500 },
                { CompanyCode: "TXSE", DiffGrossAmount: 8500 },
                { CompanyCode: "TXIT", DiffGrossAmount: 11000 },
                { CompanyCode: "TXES", DiffGrossAmount: 7200 },
                { CompanyCode: "TXNL", DiffGrossAmount: 6800 }
            ];

            const aTaxCodes = [
                { TaxCode: "A1", DiffGrossAmount: 8000 },
                { TaxCode: "B2", DiffGrossAmount: 12000 },
                { TaxCode: "C3", DiffGrossAmount: 6500 },
                { TaxCode: "D4", DiffGrossAmount: 11000 },
                { TaxCode: "E5", DiffGrossAmount: 4500 },
                { TaxCode: "F6", DiffGrossAmount: 9500 },
                { TaxCode: "G7", DiffGrossAmount: 7800 },
                { TaxCode: "H8", DiffGrossAmount: 6200 },
                { TaxCode: "I9", DiffGrossAmount: 10500 },
                { TaxCode: "J10", DiffGrossAmount: 8800 },
                { TaxCode: "K11", DiffGrossAmount: 5400 },
                { TaxCode: "L12", DiffGrossAmount: 11200 },
                { TaxCode: "M13", DiffGrossAmount: 6900 },
                { TaxCode: "N14", DiffGrossAmount: 5100 }
            ];

            const oViewModel = this.getView().getModel("view");
            if (oViewModel) {
                oViewModel.setProperty("/reconciliationDetail/treemapData/companyCodes", aCompanyCodes);
                oViewModel.setProperty("/reconciliationDetail/treemapData/taxCodes", aTaxCodes);
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
        }
    });

    return ReconciliationDetailController;
});

