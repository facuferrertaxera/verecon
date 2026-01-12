sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/Column",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ColumnListItem",
    "sap/m/Token",
    "sap/m/SearchField"
], function (JSONModel, MessageBox, MessageToast, Filter, FilterOperator, UITableColumn, MColumn, Text, Label, ColumnListItem, Token, SearchField) {
    "use strict";

    return {
        /**
         * Opens the Reconciliation dialog
         */
        openNewReconciliation: async function () {
            const oView = this.getView();
            const oReconciliationDialog = this.getView().byId("ReconciliationDialog");
            if (!oReconciliationDialog) {
                MessageToast.show("Dialog not found. Please refresh the page.");
                return;
            }

            const oViewModel = oView.getModel("view");
            if (!oViewModel) {
                oView.setModel(new JSONModel(), "view");
            }
            
            // Clear SmartFilterBar and reset validation state before opening
            const oSmartFilterBar = oView.byId("reconciliationSmartFilterBar");
            if (oSmartFilterBar) {
                oSmartFilterBar.fireClear();
            }
            
            // Clear custom controls
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            if (oCountryInput) {
                oCountryInput.setValueState("None");
                oCountryInput.setTokens([]);
            }
            
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            if (oCompanyCodeInput) {
                oCompanyCodeInput.setValueState("None");
                oCompanyCodeInput.setTokens([]);
            }
            
            oReconciliationDialog.open();
        },


        /**
         * Handler for cancel button
         */
        onNewReconciliationCancel: function () {
            const oView = this.getView();
            const oSmartFilterBar = oView.byId("reconciliationSmartFilterBar");
            if (oSmartFilterBar) {
                oSmartFilterBar.fireClear();
            }
            oView.byId("ReconciliationDialog").close();
        },

        /**
         * Handler for search event - prevent default behavior
         */
        onReconciliationSearch: function(oEvent) {
            // Prevent the standard call
            oEvent.preventDefault();
        },

        /**
         * Handler for assigned filters changed
         */
        onReconciliationAssignedFiltersChanged: function() {
            // Can be used to react to filter changes if needed
        },

        /**
         * Handler for proceed button - validates and creates reconciliation via NewRecParameter read
         */
        onNewReconciliationProceed: async function () {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oSmartFilterBar = oView.byId("reconciliationSmartFilterBar");
            
            if (!oSmartFilterBar) {
                MessageToast.show("SmartFilterBar not found.");
                return;
            }

            // Validate custom controls first (since SmartFilterBar.validateMandatoryFields might not work for custom controls)
            let bIsValid = true;
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            if (oCountryInput) {
                const aCountryTokens = oCountryInput.getTokens();
                if (!aCountryTokens || aCountryTokens.length === 0) {
                    oCountryInput.setValueState("Error");
                    bIsValid = false;
                } else {
                    oCountryInput.setValueState("None");
                }
            }
            
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            if (oCompanyCodeInput) {
                const aCompanyCodeTokens = oCompanyCodeInput.getTokens();
                if (!aCompanyCodeTokens || aCompanyCodeTokens.length === 0) {
                    oCompanyCodeInput.setValueState("Error");
                    bIsValid = false;
                } else {
                    oCompanyCodeInput.setValueState("None");
                }
            }
            
            // Validate other SmartFilterBar fields (like reporting_date)
            if (!oSmartFilterBar.validateMandatoryFields()) {
                bIsValid = false;
            }
            
            if (!bIsValid) {
                MessageToast.show(this.i18n("reconciliationPopup.PleaseFillAllMandatoryFields"));
                return;
            }

            // Get filters from SmartFilterBar
            let aFilters = oSmartFilterBar.getFilters();

            // Manually add filters from custom MultiInput controls
            // Since we're using custom controls, SmartFilterBar.getFilters() won't include them
            const aCustomFilters = [];
            
            // Get country from custom MultiInput control (reuse oCountryInput from validation above)
            if (oCountryInput) {
                const aCountryTokens = oCountryInput.getTokens();
                if (aCountryTokens && aCountryTokens.length > 0) {
                    // Get the first token (only one allowed due to maxTokens="1")
                    const sCountry = aCountryTokens[0].getKey();
                    if (sCountry) {
                        aCustomFilters.push(new Filter("country", FilterOperator.EQ, sCountry));
                    }
                }
            }
            
            // Get company codes from custom MultiInput control (reuse oCompanyCodeInput from validation above)
            if (oCompanyCodeInput) {
                const aCompanyCodeTokens = oCompanyCodeInput.getTokens();
                if (aCompanyCodeTokens && aCompanyCodeTokens.length > 0) {
                    const aCompanyCodes = aCompanyCodeTokens.map(function(oToken) {
                        return oToken.getKey();
                    });
                    if (aCompanyCodes.length === 1) {
                        aCustomFilters.push(new Filter("companycode", FilterOperator.EQ, aCompanyCodes[0]));
                    } else if (aCompanyCodes.length > 1) {
                        aCustomFilters.push(new Filter("companycode", FilterOperator.IN, aCompanyCodes));
                    }
                }
            }
            
            // Merge custom filters with SmartFilterBar filters
            if (aCustomFilters.length > 0) {
                // Remove any existing country/companycode filters from SmartFilterBar filters
                if (aFilters && aFilters.length > 0 && aFilters[0].aFilters) {
                    aFilters[0].aFilters = aFilters[0].aFilters.filter(function(oFilter) {
                        if (oFilter.aFilters && oFilter.aFilters[0]) {
                            const sPath = oFilter.aFilters[0].sPath;
                            return sPath !== "country" && sPath !== "companycode";
                        }
                        const sPath = oFilter.sPath;
                        return sPath !== "country" && sPath !== "companycode";
                    });
                    // Add custom filters
                    aFilters[0].aFilters = aFilters[0].aFilters.concat(aCustomFilters);
                } else if (aFilters && aFilters.length > 0) {
                    // If filters structure is different, just add custom filters
                    aFilters = aFilters.concat(aCustomFilters);
                } else {
                    // No existing filters, create new filter group
                    aFilters = [new Filter({filters: aCustomFilters, and: true})];
                }
            }

            // Get variant name from SmartVariantManagement
            let sVariant = "";
            try {
                const oVariantMgmt = oView.byId("reconciliationSmartVariantManagement");
                if (oVariantMgmt) {
                    const sCurrentVariantKey = oVariantMgmt.getCurrentVariantKey();
                    if (sCurrentVariantKey) {
                        const oVariantItem = oVariantMgmt.getItemByKey(sCurrentVariantKey);
                        if (oVariantItem) {
                            sVariant = oVariantItem.getProperty("title") || "";
                        }
                    }
                }
            } catch (oError) {
                // If variant retrieval fails, variant will remain empty
                console.warn("Could not get variant name from SmartVariantManagement:", oError);
            }

            // Fix UTC for date filters
            this._fixUTC("reporting_date", aFilters);

            // Add variant filter if provided (variant name from SmartVariantManagement)
            if (sVariant) {
                aFilters.push(new Filter("variant", FilterOperator.EQ, sVariant));
            }

            try {
                oReconciliationDialog.setBusy(true);
                
                // Single read to NewRecParameter with all filters
                // Backend will handle finding all matching records and doing the reconciliation
                const oResponse = await this.promRead("/NewRecParameter", {
                    filters: aFilters,
                    urlParameters: {
                        "$select": "companycode,country,reporting_date,recon_id"
                    }
                });
                
                oReconciliationDialog.close();
                oSmartFilterBar.fireClear();
                this._refreshView();
                MessageToast.show(this.i18n("reconciliationList.CreateReconciliationConfirmation"));
            } catch (oError) {
                this._handleReconciliationCreateError(oError);
            } finally {
                oReconciliationDialog.setBusy(false);
            }
        },

        /**
         * Fix UTC for date filters
         * @private
         */
        _fixUTC: function(sDateProperty, aFilters) {
            if (!aFilters || aFilters.length === 0 || !aFilters[0].aFilters) {
                return;
            }
            
            let oDateFilter = aFilters[0].aFilters.find(function(oFilter) {
                return oFilter.aFilters && oFilter.aFilters[0] && oFilter.aFilters[0].sPath === sDateProperty;
            });
            
            if (!oDateFilter || !oDateFilter.aFilters || !oDateFilter.aFilters[0]) {
                return;
            }
            
            const oInnerFilter = oDateFilter.aFilters[0];
            
            // Convert local date to UTC (ignoring timezone)
            if (oInnerFilter.oValue1) {
                const oDate1 = new Date(oInnerFilter.oValue1);
                oInnerFilter.oValue1 = new Date(Date.UTC(
                    oDate1.getFullYear(),
                    oDate1.getMonth(),
                    oDate1.getDate(),
                    0, 0, 0, 0
                )).toISOString();
            }
            
            if (oInnerFilter.oValue2) {
                const oDate2 = new Date(oInnerFilter.oValue2);
                oInnerFilter.oValue2 = new Date(Date.UTC(
                    oDate2.getFullYear(),
                    oDate2.getMonth(),
                    oDate2.getDate(),
                    23, 59, 59, 999
                )).toISOString();
            }
        },

        /**
         * Extract filter values from SmartFilterBar filters
         * @private
         */
        _extractFilterValues: function(aFilters) {
            const mValues = {
                companycodes: [],
                countries: [],
                reporting_date: null
            };

            if (!aFilters || aFilters.length === 0) {
                return mValues;
            }

            // SmartFilterBar filters are typically nested
            const oFilterGroup = aFilters[0];
            if (oFilterGroup && oFilterGroup.aFilters) {
                oFilterGroup.aFilters.forEach(function(oFilter) {
                    if (oFilter.aFilters) {
                        oFilter.aFilters.forEach(function(oInnerFilter) {
                            const sPath = oInnerFilter.sPath || oInnerFilter.getPath();
                            const sOperator = oInnerFilter.sOperator || oInnerFilter.getOperator();
                            
                            if (sPath === "companycode") {
                                if (sOperator === "EQ") {
                                    const sValue = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                    if (sValue && mValues.companycodes.indexOf(sValue) === -1) {
                                        mValues.companycodes.push(sValue);
                                    }
                                } else if (sOperator === "IN") {
                                    const aValues = oInnerFilter.aValues || oInnerFilter.getValues();
                                    if (aValues) {
                                        aValues.forEach(function(sValue) {
                                            if (mValues.companycodes.indexOf(sValue) === -1) {
                                                mValues.companycodes.push(sValue);
                                            }
                                        });
                                    }
                                }
                            } else if (sPath === "country") {
                                if (sOperator === "EQ") {
                                    const sValue = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                    if (sValue && mValues.countries.indexOf(sValue) === -1) {
                                        mValues.countries.push(sValue);
                                    }
                                } else if (sOperator === "IN") {
                                    const aValues = oInnerFilter.aValues || oInnerFilter.getValues();
                                    if (aValues) {
                                        aValues.forEach(function(sValue) {
                                            if (mValues.countries.indexOf(sValue) === -1) {
                                                mValues.countries.push(sValue);
                                            }
                                        });
                                    }
                                }
                            } else if (sPath === "reporting_date") {
                                // Date range filter - get the "to" date as reporting_date
                                if (sOperator === "BT") {
                                    mValues.reporting_date = oInnerFilter.oValue2 || oInnerFilter.getValue2();
                                } else if (sOperator === "EQ") {
                                    mValues.reporting_date = oInnerFilter.oValue1 || oInnerFilter.getValue1();
                                }
                            }
                        });
                    }
                });
            }

            return mValues;
        },



        /**
         * Handler for reconciliation creation error
         */
        _handleReconciliationCreateError: function (oError) {
            let sMessage = this.i18n("error.generic");
            if (oError && oError.responseText) {
                try {
                    const oErrorData = JSON.parse(oError.responseText);
                    sMessage = oErrorData.error ? oErrorData.error.message.value : sMessage;
                } catch (e) {
                    // If parsing fails, use default message
                }
            }
            MessageBox.error(sMessage);
        },

        /**
         * Handler for country value help request in reconciliation dialog
         */
        onReconciliationCountryValueHelpRequest: function (oEvent) {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            const oMultiInput = oView.byId("reconciliationCountryListInput");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            oVHD.setTokens([]);
            const aTokens = oMultiInput.getTokens();
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/Country",
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        const oColumnCountry = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationPopup.Country")}),
                            template: new Text({text: "{Country}"})
                        });
                        oColumnCountry.data("fieldName", "Country");
                        
                        const oColumnName = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CountryName")}),
                            template: new Text({text: "{Country_Text}"})
                        });
                        oColumnName.data("fieldName", "Country_Text");
                        
                        oTable.addColumn(oColumnCountry);
                        oTable.addColumn(oColumnName);
                    }
                }
                
                if (oTable.bindItems) {
                    oTable.bindAggregation("items", {
                        path: "/Country",
                        template: new ColumnListItem({
                            cells: [
                                new Label({text: "{Country}"}),
                                new Label({text: "{Country_Text}"})
                            ]
                        }),
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationPopup.Country")})}));
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CountryName")})}));
                    }
                }
                
                oVHD.update();
            });
            
            oVHD.open();
        },

        /**
         * Handler for country value help OK in reconciliation dialog
         */
        onReconciliationCountryValueHelpOk: function (oEvent) {
            const oView = this.getView();
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = oView.byId("reconciliationCountryListInput");
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            
            // Limit to only 1 token (first token if multiple are returned)
            const aLimitedTokens = aTokens && aTokens.length > 0 ? [aTokens[0]] : [];
            oMultiInput.setTokens(aLimitedTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for country value help cancel in reconciliation dialog
         */
        onReconciliationCountryValueHelpCancel: function () {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for country value help after close in reconciliation dialog
         */
        onReconciliationCountryValueHelpAfterClose: function () {
            // Cleanup if needed
        },

        /**
         * Handler for country value help search
         */
        onReconciliationCountryValueHelpSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCountryValueHelpDialog");
            
            if (!oVHD) {
                return;
            }
            
            oVHD.getTableAsync().then((oTable) => {
                const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
                if (oBinding) {
                    let aFilters = [];
                    if (sQuery && sQuery.trim() !== "") {
                        // Search in both Country code and Country name
                        const aSearchFilters = [
                            new Filter("Country", FilterOperator.Contains, sQuery),
                            new Filter("Country_Text", FilterOperator.Contains, sQuery)
                        ];
                        aFilters.push(new Filter({filters: aSearchFilters, and: false}));
                    }
                    oBinding.filter(aFilters);
                }
            });
        },

        /**
         * Handler for company code value help request in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpRequest: function (oEvent) {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            const oMultiInput = oView.byId("reconciliationCompanyCodeListInput");
            const oModel = this.getModel();
            
            if (!oVHD || !oModel) {
                return;
            }

            oVHD.setTokens([]);
            const aTokens = oMultiInput ? oMultiInput.getTokens() : [];
            const aClonedTokens = aTokens.map((oToken) => {
                return new Token({
                    key: oToken.getKey(),
                    text: oToken.getText()
                });
            });
            oVHD.setTokens(aClonedTokens);
            
            // Get selected country from the custom country MultiInput to filter company codes
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            let sSelectedCountry = null;
            let sSelectedCountryName = null;
            if (oCountryInput) {
                const aCountryTokens = oCountryInput.getTokens();
                if (aCountryTokens && aCountryTokens.length > 0) {
                    sSelectedCountry = aCountryTokens[0].getKey();
                    sSelectedCountryName = aCountryTokens[0].getText();
                }
            }
            
            // Update dialog title to show country filter if a country is selected
            if (sSelectedCountry && sSelectedCountryName) {
                const sTitle = this.i18n("reconciliationPopup.CompanyCodesFilteredByCountry", [sSelectedCountryName]);
                oVHD.setTitle(sTitle);
            } else {
                oVHD.setTitle(this.i18n("reconciliationList.SelectCompanyCodes"));
            }
            
            // Build filters array - filter by country if one is selected
            const aFilters = [];
            if (sSelectedCountry) {
                aFilters.push(new Filter("Country", FilterOperator.EQ, sSelectedCountry));
            }
            
            oVHD.getTableAsync().then((oTable) => {
                oTable.setModel(oModel);
                
                if (oTable.bindRows) {
                    oTable.bindAggregation("rows", {
                        path: "/CompanyVH",
                        filters: aFilters.length > 0 ? aFilters : undefined,
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        const oColumnCode = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CompanyCodeList")}),
                            template: new Text({text: "{CompanyCode}"})
                        });
                        oColumnCode.data("fieldName", "CompanyCode");
                        
                        const oColumnName = new UITableColumn({
                            label: new Label({text: this.i18n("reconciliationList.CompanyName")}),
                            template: new Text({text: "{Name}"})
                        });
                        oColumnName.data("fieldName", "Name");
                        
                        oTable.addColumn(oColumnCode);
                        oTable.addColumn(oColumnName);
                    }
                }
                
                if (oTable.bindItems) {
                    oTable.bindAggregation("items", {
                        path: "/CompanyVH",
                        filters: aFilters.length > 0 ? aFilters : undefined,
                        template: new ColumnListItem({
                            cells: [
                                new Label({text: "{CompanyCode}"}),
                                new Label({text: "{Name}"})
                            ]
                        }),
                        events: {
                            dataReceived: () => {
                                oVHD.update();
                            }
                        }
                    });
                    
                    if (oTable.getColumns().length === 0) {
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CompanyCodeList")})}));
                        oTable.addColumn(new MColumn({header: new Label({text: this.i18n("reconciliationList.CompanyName")})}));
                    }
                }
                
                oVHD.update();
            });
            
            oVHD.open();
        },

        /**
         * Handler for company code value help OK in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpOk: function (oEvent) {
            const oView = this.getView();
            const aTokens = oEvent.getParameter("tokens");
            const oMultiInput = oView.byId("reconciliationCompanyCodeListInput");
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            
            oMultiInput.setTokens(aTokens);
            
            if (oVHD) {
                oVHD.close();
            }
        },

        /**
         * Handler for company code value help cancel in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpCancel: function () {
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            oVHD.close();
        },

        /**
         * Handler for company code value help after close in reconciliation dialog
         */
        onReconciliationCompanyCodeValueHelpAfterClose: function () {
            // Cleanup if needed
        },

        /**
         * Handler for company code value help search
         */
        onReconciliationCompanyCodeValueHelpSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oView = this.getView();
            const oVHD = oView.byId("reconciliationCompanyCodeValueHelpDialog");
            
            if (!oVHD) {
                return;
            }
            
            // Get selected country filter (existing filter)
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            let aExistingFilters = [];
            if (oCountryInput) {
                const aCountryTokens = oCountryInput.getTokens();
                if (aCountryTokens && aCountryTokens.length > 0) {
                    const sSelectedCountry = aCountryTokens[0].getKey();
                    if (sSelectedCountry) {
                        aExistingFilters.push(new Filter("Country", FilterOperator.EQ, sSelectedCountry));
                    }
                }
            }
            
            oVHD.getTableAsync().then((oTable) => {
                const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
                if (oBinding) {
                    let aFilters = aExistingFilters.slice(); // Copy existing filters
                    if (sQuery && sQuery.trim() !== "") {
                        // Search in both CompanyCode and Name
                        const aSearchFilters = [
                            new Filter("CompanyCode", FilterOperator.Contains, sQuery),
                            new Filter("Name", FilterOperator.Contains, sQuery)
                        ];
                        aFilters.push(new Filter({filters: aSearchFilters, and: false}));
                    }
                    oBinding.filter(aFilters.length > 0 ? aFilters : undefined);
                }
            });
        },

        /**
         * Load reconciliation variants from localStorage
         * @private
         */
        _loadReconciliationVariants: function () {
            const sStorageKey = "reconciliationVariants";
            const oView = this.getView();
            const oViewModel = oView.getModel("view");
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                let aVariants = [];
                
                if (sStoredVariants) {
                    const aStoredVariants = JSON.parse(sStoredVariants);
                    // Convert to VariantManagement format
                    aVariants = aStoredVariants.map(function(oVariant) {
                        return {
                            key: oVariant.key,
                            title: oVariant.title || oVariant.text,
                            author: oVariant.author || "User",
                            favorite: oVariant.favorite !== undefined ? oVariant.favorite : true,
                            sharing: oVariant.sharing || "Private",
                            data: oVariant.data
                        };
                    });
                }
                
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", aVariants);
            } catch (oError) {
                console.error("Error loading variants:", oError);
                oViewModel.setProperty("/reconciliationList/newReconciliation/variants", []);
            }
        },

        /**
         * Save reconciliation variants to localStorage
         * @private
         */
        _saveReconciliationVariants: function (aVariants) {
            const sStorageKey = "reconciliationVariants";
            
            try {
                localStorage.setItem(sStorageKey, JSON.stringify(aVariants));
            } catch (oError) {
                console.error("Error saving variants:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorSavingVariant"));
            }
        },

        /**
         * Handler for variant selection (VariantManagement select event)
         */
        onReconciliationVariantSelect: function (oEvent) {
            const oParams = oEvent.getParameters();
            const sSelectedKey = oParams.key;
            
            if (!sSelectedKey) {
                return;
            }
            
            const sStorageKey = "reconciliationVariants";
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                if (!sStoredVariants) {
                    return;
                }
                
                const aVariants = JSON.parse(sStoredVariants);
                const oSelectedVariant = aVariants.find(function(oVariant) {
                    return oVariant.key === sSelectedKey;
                });
                
                if (oSelectedVariant && oSelectedVariant.data) {
                    this._applyReconciliationVariant(oSelectedVariant.data);
                }
                
                // Mark as not modified after selection
                const oVariantManagement = this.getView().byId("reconciliationVariantManagement");
                if (oVariantManagement) {
                    oVariantManagement.setModified(false);
                }
            } catch (oError) {
                console.error("Error loading variant:", oError);
                MessageToast.show(this.i18n("reconciliationPopup.ErrorLoadingVariant"));
            }
        },

        /**
         * Apply variant data to form fields
         * @private
         */
        _applyReconciliationVariant: function (oVariantData) {
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oContext = oReconciliationDialog.getBindingContext();
            const sPath = oContext.getPath();
            const oModel = oReconciliationDialog.getModel();
            
            // Apply date range
            if (oVariantData.FromDate && oVariantData.ToDate) {
                oModel.setProperty(sPath + "/FromDate", oVariantData.FromDate);
                oModel.setProperty(sPath + "/ToDate", oVariantData.ToDate);
            }
            
            // Apply country tokens
            if (oVariantData.CountryList && Array.isArray(oVariantData.CountryList)) {
                const aCountryTokens = oVariantData.CountryList.map(function(oCountry) {
                    return new Token({
                        key: oCountry.key,
                        text: oCountry.text
                    });
                });
                oView.byId("reconciliationCountryListInput").setTokens(aCountryTokens);
            }
            
            // Apply company code tokens
            if (oVariantData.CompanyCodeList && Array.isArray(oVariantData.CompanyCodeList)) {
                const aCompanyCodeTokens = oVariantData.CompanyCodeList.map(function(oCompanyCode) {
                    return new Token({
                        key: oCompanyCode.key,
                        text: oCompanyCode.text
                    });
                });
                oView.byId("reconciliationCompanyCodeListInput").setTokens(aCompanyCodeTokens);
            }
        },

        /**
         * Handler for variant save (VariantManagement save event)
         */
        onReconciliationVariantSave: function (oEvent) {
            const oParams = oEvent.getParameters();
            const sVariantName = oParams.name;
            const sVariantKey = oParams.key;
            const bOverwrite = oParams.overwrite;
            const bExecute = oParams.execute;
            const bPublic = oParams.public;
            const bDef = oParams.def;
            
            if (!sVariantName) {
                return;
            }
            
            const oView = this.getView();
            const oReconciliationDialog = oView.byId("ReconciliationDialog");
            const oContext = oReconciliationDialog.getBindingContext();
            const oReconciliation = oContext.getObject();
            
            // Get current form values
            const oCountryInput = oView.byId("reconciliationCountryListInput");
            const oCompanyCodeInput = oView.byId("reconciliationCompanyCodeListInput");
            const aCountryTokens = oCountryInput.getTokens();
            const aCompanyCodeTokens = oCompanyCodeInput.getTokens();
            
            // Check if form has values
            if (aCountryTokens.length === 0 && aCompanyCodeTokens.length === 0 && !oReconciliation.FromDate && !oReconciliation.ToDate) {
                MessageToast.show(this.i18n("reconciliationPopup.NoDataToSave"));
                oEvent.preventDefault(); // Prevent saving empty variant
                return;
            }
            
            // Build variant data
            const oVariantData = {
                FromDate: oReconciliation.FromDate,
                ToDate: oReconciliation.ToDate,
                CountryList: aCountryTokens.map(function(oToken) {
                    return {
                        key: oToken.getKey(),
                        text: oToken.getText()
                    };
                }),
                CompanyCodeList: aCompanyCodeTokens.map(function(oToken) {
                    return {
                        key: oToken.getKey(),
                        text: oToken.getText()
                    };
                })
            };
            
            // Get existing variants
            const sStorageKey = "reconciliationVariants";
            let aVariants = [];
            
            try {
                const sStoredVariants = localStorage.getItem(sStorageKey);
                if (sStoredVariants) {
                    aVariants = JSON.parse(sStoredVariants);
                }
            } catch (oError) {
                console.error("Error loading variants:", oError);
            }
            
            if (bOverwrite && sVariantKey) {
                // Update existing variant
                const nIndex = aVariants.findIndex(function(oVariant) {
                    return oVariant.key === sVariantKey;
                });
                if (nIndex >= 0) {
                    aVariants[nIndex].title = sVariantName;
                    aVariants[nIndex].data = oVariantData;
                    if (bDef) {
                        // Update default key in VariantManagement
                        const oVariantManagement = oView.byId("reconciliationVariantManagement");
                        if (oVariantManagement) {
                            oVariantManagement.setDefaultKey(sVariantKey);
                        }
                    }
                    MessageToast.show(this.i18n("reconciliationPopup.VariantSaved"));
                }
            } else {
                // Create new variant
                const sNewKey = "variant_" + Date.now();
                const oNewVariant = {
                    key: sNewKey,
                    title: sVariantName,
                    author: "User",
                    favorite: true,
                    data: oVariantData
                };
                
                if (bPublic) {
                    oNewVariant.sharing = "Public";
                } else {
                    oNewVariant.sharing = "Private";
                }
                
                aVariants.push(oNewVariant);
                
                // Update default key if needed
                if (bDef) {
                    const oVariantManagement = oView.byId("reconciliationVariantManagement");
                    if (oVariantManagement) {
                        oVariantManagement.setDefaultKey(sNewKey);
                    }
                }
                
                MessageToast.show(this.i18n("reconciliationPopup.VariantSaved"));
            }
            
            // Save to localStorage
            this._saveReconciliationVariants(aVariants);
            
            // Reload variants in UI
            this._loadReconciliationVariants();
            
            // Mark as not modified after save
            const oVariantManagement = oView.byId("reconciliationVariantManagement");
            if (oVariantManagement) {
                oVariantManagement.setModified(false);
            }
        },

        /**
         * Handler for variant manage (VariantManagement manage event)
         * This is called when user manages variants (delete, set default, etc.)
         */
        onReconciliationVariantManage: function (oEvent) {
            const oParams = oEvent.getParameters();
            const aDeleted = oParams.deleted || [];
            const sDef = oParams.def;
            
            // Handle deleted variants
            if (aDeleted.length > 0) {
                const sStorageKey = "reconciliationVariants";
                let aVariants = [];
                
                try {
                    const sStoredVariants = localStorage.getItem(sStorageKey);
                    if (sStoredVariants) {
                        aVariants = JSON.parse(sStoredVariants);
                    }
                } catch (oError) {
                    console.error("Error loading variants:", oError);
                }
                
                // Remove deleted variants
                aVariants = aVariants.filter(function(oVariant) {
                    return aDeleted.indexOf(oVariant.key) === -1;
                });
                
                // Save updated variants
                this._saveReconciliationVariants(aVariants);
                
                // Reload variants in UI
                this._loadReconciliationVariants();
            }
            
            // Handle default key change
            if (sDef !== undefined) {
                const oVariantManagement = this.getView().byId("reconciliationVariantManagement");
                if (oVariantManagement) {
                    oVariantManagement.setDefaultKey(sDef);
                }
            }
            
            // Check current variant is still valid
            this._checkCurrentVariant();
        },
        
        /**
         * Check if current selected variant still exists, if not select default
         * @private
         */
        _checkCurrentVariant: function () {
            const oView = this.getView();
            const oVariantManagement = oView.byId("reconciliationVariantManagement");
            
            if (!oVariantManagement) {
                return;
            }
            
            const sSelectedKey = oVariantManagement.getSelectedKey();
            const oItem = oVariantManagement.getItemByKey(sSelectedKey);
            
            if (!oItem) {
                const sDefaultKey = oVariantManagement.getDefaultKey();
                if (sDefaultKey) {
                    oVariantManagement.setSelectedKey(sDefaultKey);
                } else {
                    // If no default, select first available variant
                    const aItems = oVariantManagement.getItems();
                    if (aItems.length > 0) {
                        oVariantManagement.setSelectedKey(aItems[0].getKey());
                    }
                }
            }
        },

    };
});





