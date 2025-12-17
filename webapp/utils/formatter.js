sap.ui.define([
    "sap/m/Token"
], (Token) => {
    "use strict";

    return {
        /**
         * Format status icon based on status code
         * Uses dynamic status data from OData service and pattern matching
         * @param {string} sStatus - Status code
         * @returns {string} Icon path
         */
        formatStatusIcon: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // Get status map from controller if available
            const mStatusMap = (this._oController && this._oController._mStatusMap) ? this._oController._mStatusMap : {};
            
            // Pattern-based icon determination
            // Success statuses (start with S): S, SR, SV, ST, SX, SS
            if (sStatus.indexOf("S") === 0) {
                return "sap-icon://accept";
            }
            
            // Failed statuses (start with F): F, FR, FV, FT, FX, FS, FE
            if (sStatus.indexOf("F") === 0) {
                return "sap-icon://error";
            }
            
            // In Progress statuses (end with P): P, RP, VP, XP
            if (sStatus.lastIndexOf("P") === sStatus.length - 1) {
                return "sap-icon://status-in-process";
            }
            
            // Extracted
            if (sStatus === "E") {
                return "sap-icon://complete";
            }
            
            // Created
            if (sStatus === "C") {
                return "sap-icon://status-in-process";
            }
            
            // Pending Archiving
            if (sStatus === "PA") {
                return "sap-icon://pending";
            }
            
            // Tax Authority Review
            if (sStatus === "TR") {
                return "sap-icon://status-in-process";
            }
            
            // Default fallback
            return "sap-icon://status-in-process";
        },

        /**
         * Format status color based on status code
         * Uses dynamic status data from OData service and pattern matching
         * @param {string} sStatus - Status code
         * @returns {string} Status state (None, Success, Warning, Error)
         */
        formatStatusColor: function(sStatus) {
            if (!sStatus) {
                return "None";
            }
            
            // Get status map from controller if available
            const mStatusMap = (this._oController && this._oController._mStatusMap) ? this._oController._mStatusMap : {};
            
            // Pattern-based color determination
            // Success statuses (start with S): S, SR, SV, ST, SX, SS
            if (sStatus.indexOf("S") === 0) {
                return "Success";
            }
            
            // Failed statuses (start with F): F, FR, FV, FT, FX, FS, FE
            if (sStatus.indexOf("F") === 0) {
                return "Error";
            }
            
            // In Progress statuses (end with P): P, RP, VP, XP
            if (sStatus.lastIndexOf("P") === sStatus.length - 1) {
                return "Warning";
            }
            
            // Extracted
            if (sStatus === "E") {
                return "Success";
            }
            
            // Created
            if (sStatus === "C") {
                return "Warning";
            }
            
            // Pending Archiving
            if (sStatus === "PA") {
                return "Warning";
            }
            
            // Tax Authority Review
            if (sStatus === "TR") {
                return "Warning";
            }
            
            // Default fallback
            return "None";
        },

        /**
         * Store controller reference for formatters
         */
        _oController: null,

        /**
         * Set controller reference
         */
        setController: function(oController) {
            this._oController = oController;
        },

        /**
         * Format country list to tokens array
         * @param {string} sCountryList - Comma-separated country codes
         * @returns {Array} Array of Token objects
         */
        formatCountryListToTokens: function(sCountryList) {
            if (!sCountryList) {
                return [];
            }
            
            const aCountryCodes = sCountryList.split(",").map(s => s.trim()).filter(s => s);
            const mCountryMap = (this._oController && this._oController._mCountryMap) ? this._oController._mCountryMap : {};
            
            return aCountryCodes.map((sCode) => {
                // Get country name from map, fallback to code if not found
                const sCountryName = (mCountryMap && mCountryMap[sCode]) ? mCountryMap[sCode] : sCode;
                // Format as "CountryName (CODE)"
                return new Token({
                    key: sCode,
                    text: sCountryName + " (" + sCode + ")"
                });
            });
        },

        /**
         * Format company code list to tokens array
         * @param {string} sCompanyCodeList - Comma-separated company codes
         * @returns {Array} Array of Token objects
         */
        formatCompanyCodeListToTokens: function(sCompanyCodeList) {
            if (!sCompanyCodeList) {
                return [];
            }
            
            const aCompanyCodes = sCompanyCodeList.split(",").map(s => s.trim()).filter(s => s);
            
            return aCompanyCodes.map((sCode) => {
                return new Token({
                    key: sCode,
                    text: sCode
                });
            });
        }
    };
});

