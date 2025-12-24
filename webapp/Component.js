sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/Sorter",
    "tech/taxera/taxreporting/verecon/model/models"
], (UIComponent, Sorter, models) => {
    "use strict";

    return UIComponent.extend("tech.taxera.taxreporting.verecon.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // Initialize maps - these will be populated asynchronously
            this._mCountryMap = {};
            this._mCompanyCodeMap = {};
            this._mStatusMap = {};
            
            // Promise that resolves when all maps are loaded
            this._oMapsReadyPromise = null;

            // Load maps early - before views are initialized
            this._loadMaps();

            // enable routing
            this.getRouter().initialize();
        },

        /**
         * Helper to wrap OData model.read() in a Promise
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model
         * @param {string} sPath - Entity path
         * @param {object} mParameters - Read parameters (urlParameters, sorters, etc.)
         * @returns {Promise} Promise that resolves with response or rejects with error
         */
        _readOData: function(oModel, sPath, mParameters) {
            return new Promise((resolve, reject) => {
                const mReadParams = {
                    success: resolve,
                    error: reject
                };
                
                // Copy parameters (urlParameters, sorters, etc.) to read params
                if (mParameters) {
                    Object.keys(mParameters).forEach((sKey) => {
                        if (sKey !== "success" && sKey !== "error") {
                            mReadParams[sKey] = mParameters[sKey];
                        }
                    });
                }
                
                oModel.read(sPath, mReadParams);
            });
        },

        /**
         * Load all maps (countries, company codes, statuses) in parallel
         * This is called during component initialization to ensure maps are ready
         * before any view/controller needs them
         */
        _loadMaps: async function() {
            // Wait a bit for model to be initialized
            await new Promise((resolve) => setTimeout(resolve, 100));
            
            const oModel = this.getModel();
            if (!oModel) {
                console.error("[Component._loadMaps] Model not available, will retry");
                // Retry after a delay
                setTimeout(() => {
                    this._loadMaps();
                }, 500);
                return;
            }

            console.log("[Component._loadMaps] Loading maps...");

            // Create promise that resolves when all maps are loaded
            this._oMapsReadyPromise = Promise.all([
                this._loadAvailableCountries(oModel),
                this._loadAvailableCompanyCodes(oModel),
                this._loadAvailableStatuses(oModel)
            ]).then(() => {
                console.log("[Component._loadMaps] All maps loaded successfully");
            }).catch((oError) => {
                console.error("[Component._loadMaps] Error loading maps:", oError);
            });
        },

        /**
         * Load available countries from Country entity set
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model
         * @returns {Promise} Promise that resolves when countries are loaded
         */
        _loadAvailableCountries: async function(oModel) {
            try {
                const oResponse = await this._readOData(oModel, "/Country", {
                    urlParameters: {
                        "$select": "Country,Country_Text,CountryName"
                    },
                    sorters: [
                        new Sorter("Country", false)
                    ]
                });

                const aResults = oResponse.results || [];
                
                // Create country code to name mapping
                this._mCountryMap = {};
                aResults.forEach((oCountry) => {
                    this._mCountryMap[oCountry.Country] = oCountry.Country_Text || oCountry.CountryName || oCountry.Country;
                });

                console.log("[Component._loadAvailableCountries] Country map populated with", Object.keys(this._mCountryMap).length, "countries");
            } catch (oError) {
                console.error("[Component._loadAvailableCountries] Error loading countries:", oError);
                this._mCountryMap = {};
            }
        },

        /**
         * Load available company codes from CompanyVH entity set
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model
         * @returns {Promise} Promise that resolves when company codes are loaded
         */
        _loadAvailableCompanyCodes: async function(oModel) {
            try {
                const oResponse = await this._readOData(oModel, "/CompanyVH", {
                    urlParameters: {
                        "$select": "CompanyCode,Name,Country,CountryName"
                    },
                    sorters: [
                        new Sorter("CompanyCode", false)
                    ]
                });

                const aResults = oResponse.results || [];
                
                // Create company code to name mapping
                this._mCompanyCodeMap = {};
                aResults.forEach((oCompany) => {
                    this._mCompanyCodeMap[oCompany.CompanyCode] = oCompany.Name || oCompany.CompanyCode;
                });

                console.log("[Component._loadAvailableCompanyCodes] Company code map populated with", Object.keys(this._mCompanyCodeMap).length, "company codes");
            } catch (oError) {
                console.error("[Component._loadAvailableCompanyCodes] Error loading company codes:", oError);
                this._mCompanyCodeMap = {};
            }
        },

        /**
         * Load available statuses from xTAXERAxI_SF_STATUS_VH entity set
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model
         * @returns {Promise} Promise that resolves when statuses are loaded
         */
        _loadAvailableStatuses: async function(oModel) {
            try {
                const oResponse = await this._readOData(oModel, "/xTAXERAxI_SF_STATUS_VH", {
                    urlParameters: {
                        "$select": "Status,Description,value_position"
                    },
                    sorters: [
                        new Sorter("value_position", false)
                    ]
                });

                const aResults = oResponse.results || [];
                
                // Create status code to description mapping
                this._mStatusMap = {};
                aResults.forEach((oStatus) => {
                    this._mStatusMap[oStatus.Status] = {
                        description: oStatus.Description || oStatus.Status,
                        status: oStatus.Status
                    };
                });

                console.log("[Component._loadAvailableStatuses] Status map populated with", Object.keys(this._mStatusMap).length, "statuses");
            } catch (oError) {
                console.error("[Component._loadAvailableStatuses] Error loading statuses:", oError);
                this._mStatusMap = {};
            }
        },

        /**
         * Get the maps ready promise
         * @returns {Promise} Promise that resolves when all maps are loaded
         */
        getMapsReadyPromise: function() {
            return this._oMapsReadyPromise || Promise.resolve();
        }
    });
});