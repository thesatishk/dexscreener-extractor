document.addEventListener('DOMContentLoaded', function() {
    const webhookUrlInput = document.getElementById('webhookUrl');
    const extractButton = document.getElementById('extractButton');
    const saveSettingsButton = document.getElementById('saveSettingsButton');
    const statusDiv = document.getElementById('status');
    const autoExtractToggle = document.getElementById('autoExtractToggle');
    const intervalSelect = document.getElementById('extractInterval');
    const lastExtractionDiv = document.getElementById('lastExtraction');
    const nextExtractionDiv = document.getElementById('nextExtraction');
    
    // Load saved settings
    chrome.storage.local.get(['webhookUrl', 'autoExtractEnabled', 'extractInterval', 'extractionHistory'], function(result) {
      // Set webhook URL
      if (result.webhookUrl) {
        webhookUrlInput.value = result.webhookUrl;
      }
      
      // Set auto-extract toggle
      if (autoExtractToggle) {
        autoExtractToggle.checked = result.autoExtractEnabled !== undefined ? result.autoExtractEnabled : true;
      }
      
      // Set interval selection
      if (intervalSelect && result.extractInterval) {
        const minutes = result.extractInterval / (60 * 1000);
        intervalSelect.value = minutes.toString();
      }
      
      // Show last extraction time if available
      if (lastExtractionDiv && result.extractionHistory && result.extractionHistory.length > 0) {
        const lastExtraction = result.extractionHistory[result.extractionHistory.length - 1];
        const date = new Date(lastExtraction.timestamp);
        lastExtractionDiv.textContent = `Last extraction: ${date.toLocaleTimeString()} (${lastExtraction.rowsExtracted} rows)`;
      }
      
      // Get current status from content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "getStatus"}, function(response) {
            if (response && response.success && nextExtractionDiv) {
              if (response.autoExtractEnabled && response.nextExtraction) {
                nextExtractionDiv.textContent = `Next scheduled extraction: ${response.nextExtraction}`;
              } else {
                nextExtractionDiv.textContent = 'Auto-extraction disabled';
              }
            }
          });
        }
      });
    });
    
    // Save settings
    saveSettingsButton.addEventListener('click', function() {
      const webhookUrl = webhookUrlInput.value;
      const autoExtractEnabled = autoExtractToggle ? autoExtractToggle.checked : true;
      const intervalMinutes = intervalSelect ? parseInt(intervalSelect.value) : 60;
      const extractInterval = intervalMinutes * 60 * 1000; // Convert to milliseconds
      
      statusDiv.textContent = 'Saving settings...';
      
      // Save to storage
      chrome.storage.local.set({
        webhookUrl, 
        autoExtractEnabled,
        extractInterval
      }, function() {
        // Send updates to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs.length > 0) {
            // Update webhook URL
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateWebhook", 
              webhookUrl: webhookUrl
            });
            
            // Update auto-extract settings
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateAutoExtract",
              enabled: autoExtractEnabled
            });
            
            // Update extract interval
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateExtractInterval",
              interval: extractInterval
            }, function() {
              statusDiv.textContent = 'Settings saved!';
              
              // Request updated status
              chrome.tabs.sendMessage(tabs[0].id, {action: "getStatus"}, function(response) {
                if (response && response.success && nextExtractionDiv) {
                  if (response.autoExtractEnabled && response.nextExtraction) {
                    nextExtractionDiv.textContent = `Next scheduled extraction: ${response.nextExtraction}`;
                  } else {
                    nextExtractionDiv.textContent = 'Auto-extraction disabled';
                  }
                }
                
                setTimeout(() => {
                  statusDiv.textContent = 'Ready';
                }, 2000);
              });
            });
          } else {
            statusDiv.textContent = 'Settings saved! (No active tab detected)';
            setTimeout(() => {
              statusDiv.textContent = 'Ready';
            }, 2000);
          }
        });
      });
    });
    
    // Refresh page button
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        statusDiv.textContent = 'Refreshing page...';
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id, {}, function() {
              statusDiv.textContent = 'Page refreshed';
              setTimeout(() => {
                statusDiv.textContent = 'Ready';
              }, 2000);
            });
          } else {
            statusDiv.textContent = 'No active DEXScreener tab found';
          }
        });
      });
    }
  
    // Extract data button
    extractButton.addEventListener('click', function() {
      statusDiv.textContent = 'Extracting...';
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "extract"}, function(response) {
            if (response && response.success) {
              statusDiv.textContent = `Extracted ${response.count} items`;
              
              // Update extraction history in UI
              chrome.storage.local.get(['extractionHistory'], function(result) {
                if (result.extractionHistory && result.extractionHistory.length > 0 && lastExtractionDiv) {
                  const lastExtraction = result.extractionHistory[result.extractionHistory.length - 1];
                  const date = new Date(lastExtraction.timestamp);
                  lastExtractionDiv.textContent = `Last extraction: ${date.toLocaleTimeString()} (${lastExtraction.rowsExtracted} rows)`;
                }
              });
            } else {
              statusDiv.textContent = 'Error extracting data';
            }
          });
        } else {
          statusDiv.textContent = 'No active DEXScreener tab found';
        }
      });
    });
    
    // Auto-extract toggle handler (if exists)
    if (autoExtractToggle) {
      autoExtractToggle.addEventListener('change', function() {
        // Update UI immediately for better user feedback
        if (nextExtractionDiv) {
          if (this.checked) {
            const intervalMinutes = intervalSelect ? parseInt(intervalSelect.value) : 60;
            const nextTime = new Date(Date.now() + intervalMinutes * 60 * 1000);
            nextExtractionDiv.textContent = `Next scheduled extraction: ${nextTime.toLocaleTimeString()}`;
          } else {
            nextExtractionDiv.textContent = 'Auto-extraction disabled';
          }
        }
      });
    }
  });