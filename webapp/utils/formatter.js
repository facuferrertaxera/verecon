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
            
            // Pattern-based icon determination
            // Success statuses (start with S): S, SR, SV, ST, SX, SS
            if (sStatus.indexOf("S") === 0) {
                return "sap-icon://sys-enter-2";
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
                return "sap-icon://error";
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
                return "Error";
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
         * Format status text based on status code
         * @param {string} sStatus - Status code
         * @returns {string} Descriptive status text
         */
        formatStatusText: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            
            // Success statuses (start with S): S, SR, SV, ST, SX, SS
            if (sStatus.indexOf("S") === 0) {
                return "Success";
            }
            
            // Failed statuses (start with F): F, FR, FV, FT, FX, FS, FE
            if (sStatus.indexOf("F") === 0) {
                return "Error";
            }
            
            // Extracted
            if (sStatus === "E") {
                return "Error";
            }
            
            // In Progress statuses (end with P): P, RP, VP, XP
            if (sStatus.lastIndexOf("P") === sStatus.length - 1) {
                return "In Progress";
            }
            
            // Created
            if (sStatus === "C") {
                return "Created";
            }
            
            // Pending Archiving
            if (sStatus === "PA") {
                return "Pending Archiving";
            }
            
            // Tax Authority Review
            if (sStatus === "TR") {
                return "Tax Authority Review";
            }
            
            // Default fallback - return the status code itself
            return sStatus;
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
         * Get country map from component
         * @returns {object} Country map
         */
        _getCountryMap: function() {
            if (this._oController) {
                const oComponent = this._oController.getOwnerComponent();
                if (oComponent && oComponent._mCountryMap && Object.keys(oComponent._mCountryMap).length > 0) {
                    return oComponent._mCountryMap;
                }
            }
            return {};
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
            const mCountryMap = this._getCountryMap();
            
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
        },

        /**
         * Format difference amount state for ObjectNumber
         * @param {number} fAmount - Difference amount
         * @returns {string} State (None, Success, Warning, Error)
         */
        formatDiffAmountState: function(fAmount) {
            if (fAmount === null || fAmount === undefined) {
                return "None";
            }
            
            // If difference is zero, show as success (no difference)
            if (fAmount === 0) {
                return "Success";
            }
            
            // If there's a difference, show as error (mismatch)
            return "Error";
        },

        /**
         * Format number with scale (K, M, etc.) without currency
         * @param {number} fValue - Numeric value
         * @returns {string} Formatted value with scale
         */
        formatNumberWithScale: function(fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "0";
            }
            
            const fAbsValue = Math.abs(fValue);
            
            // Billions
            if (fAbsValue >= 1000000000) {
                const fFormatted = (fValue / 1000000000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "B";
            }
            // Millions
            else if (fAbsValue >= 1000000) {
                const fFormatted = (fValue / 1000000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "M";
            }
            // Thousands
            else if (fAbsValue >= 1000) {
                const fFormatted = (fValue / 1000).toFixed(1);
                return (parseFloat(fFormatted) % 1 === 0 ? parseInt(fFormatted) : fFormatted) + "K";
            }
            // Less than 1000
            else {
                return fValue.toString();
            }
        },

        /**
         * Format currency value with EUR
         * @param {number} fValue - Currency value
         * @returns {string} Formatted currency string
         */
        formatCurrency: function(fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "EUR 0.00";
            }
            
            // Format with 2 decimal places
            const fFormatted = Math.abs(fValue).toFixed(2);
            const sSign = fValue < 0 ? "-" : "";
            return "EUR " + sSign + fFormatted;
        }
    };
});

