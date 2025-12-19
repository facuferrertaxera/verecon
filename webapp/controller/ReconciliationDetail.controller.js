sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "tech/taxera/taxreporting/verecon/utils/formatter"
], (Controller, Filter, FilterOperator, JSONModel, formatter) => {
    "use strict";

    const ReconciliationDetailController = Controller.extend("tech.taxera.taxreporting.verecon.controller.ReconciliationDetail", {
        formatter: formatter,

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
                    }
                }
            });
            this.getView().setModel(oViewModel, "view");

            // Get router and attach route matched handler
            const oRouter = this.getOwnerComponent().getRouter();
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
            const oModel = this.getModel();
            const sReconciliationPath = `/Reconciliation('${sReconId}')`;
            
            // Bind the view to the reconciliation
            this.getView().bindElement({
                path: sReconciliationPath,
                events: {
                    dataRequested: () => {
                        this.getView().setBusy(true);
                    },
                    dataReceived: (oEvent) => {
                        this.getView().setBusy(false);
                        if (!oEvent.getParameter("data")) {
                            // Reconciliation not found
                            this.getOwnerComponent().getRouter().navTo("RouteMain");
                            return;
                        }
                        
                        // After reconciliation is loaded, bind the SmartTable
                        this._bindDocumentsTable(sReconciliationPath);
                    }
                }
            });
        },

        /**
         * Bind the documents SmartTable to the navigation property
         */
        _bindDocumentsTable: function(sReconciliationPath) {
            const oTable = this.byId("documentsTable");
            
            if (oTable) {
                // Get the template from the view (it's already defined in the XML)
                // Just bind the items aggregation to the navigation property
                const oBindingInfo = oTable.getBindingInfo("items");
                if (oBindingInfo && oBindingInfo.template) {
                    // Rebind with the navigation property path (to_Document is singular)
                    oTable.bindItems({
                        path: `${sReconciliationPath}/to_Document`,
                        template: oBindingInfo.template,
                        templateShareable: true,
                        events: {
                            dataRequested: () => {
                                this.getView().setBusy(true);
                            },
                            dataReceived: () => {
                                this.getView().setBusy(false);
                            }
                        }
                    });
                } else {
                    // If template not available yet, wait for the table to be ready
                    setTimeout(() => {
                        this._bindDocumentsTable(sReconciliationPath);
                    }, 100);
                }
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
            this.getOwnerComponent().getRouter().navTo("RouteMain");
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
        }
    });

    return ReconciliationDetailController;
});

