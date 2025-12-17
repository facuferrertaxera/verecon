sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Format status icon based on status code
         * @param {string} sStatus - Status code
         * @returns {string} Icon path
         */
        formatStatusIcon: function(sStatus) {
            if (!sStatus) {
                return "";
            }
            const mStatusIcons = {
                "C": "sap-icon://status-in-process",  // Created/In Process
                "P": "sap-icon://pending",            // Pending
                "RP": "sap-icon://complete",          // Ready/Processed
                "SS": "sap-icon://accept",            // Success
                "E": "sap-icon://error",              // Error
                "W": "sap-icon://warning"            // Warning
            };
            return mStatusIcons[sStatus] || "";
        },

        /**
         * Format status color based on status code
         * @param {string} sStatus - Status code
         * @returns {string} Status state (None, Success, Warning, Error)
         */
        formatStatusColor: function(sStatus) {
            if (!sStatus) {
                return "None";
            }
            const mStatusColors = {
                "C": "Warning",      // Created/In Process
                "P": "Warning",      // Pending
                "RP": "Success",     // Ready/Processed
                "SS": "Success",     // Success
                "E": "Error",        // Error
                "W": "Warning"       // Warning
            };
            return mStatusColors[sStatus] || "None";
        }
    };
});

