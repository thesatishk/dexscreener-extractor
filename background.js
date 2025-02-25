// Background script for DEXScreener Extractor
// This handles scheduled extractions even when DEXScreener isn't open

// Create or update the alarm when settings change
function setupAlarm() {
    chrome.storage.local.get(['autoExtractEnabled', 'extractInterval'], function(result) {
      // Clear any existing alarms
      chrome.alarms.clear('dexscreenerExtract');
      
      // Set up a new alarm if auto-extract is enabled
      if (result.autoExtractEnabled) {
        const minutes = (result.extractInterval || 60 * 60 * 1000) / (60 * 1000); // Convert to minutes
        
        chrome.alarms.create('dexscreenerExtract', {
          periodInMinutes: minutes
        });
        
        console.log(`DEXScreener Extractor: Alarm set to run every ${minutes} minutes`);
      } else {
        console.log('DEXScreener Extractor: Automatic extraction disabled');
      }
    });
  }
  
  // Handle alarm event
  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'dexscreenerExtract') {
      // Check if we should run an extraction
      chrome.storage.local.get(['autoExtractEnabled', 'webhookUrl'], function(result) {
        if (result.autoExtractEnabled && result.webhookUrl) {
          // Find a DEXScreener tab if one exists
          chrome.tabs.query({url: 'https://dexscreener.com/*'}, function(tabs) {
            if (tabs.length > 0) {
              // Use the first DEXScreener tab found - refresh it first
              chrome.tabs.reload(tabs[0].id, {}, function() {
                // Wait for the page to reload completely before extracting
                setTimeout(function() {
                  chrome.tabs.sendMessage(tabs[0].id, {action: 'extract'}, function(response) {
                    if (response && response.success) {
                      console.log(`DEXScreener Extractor: Auto-extracted ${response.count} rows`);
                    } else {
                      console.log('DEXScreener Extractor: Failed to extract data from active tab');
                    }
                  });
                }, 5000); // Give the page 5 seconds to reload
              });
            } else {
              // No DEXScreener tab is open, so create one
              chrome.tabs.create({
                url: 'https://dexscreener.com/',
                active: false // Open in background
              }, function(tab) {
                // Wait for the page to load completely, then refresh it to get latest data
                setTimeout(function() {
                  chrome.tabs.reload(tab.id, {}, function() {
                    // Wait for the refresh to complete before extracting
                    setTimeout(function() {
                      chrome.tabs.sendMessage(tab.id, {
                        action: 'extract',
                        autoClose: true // Signal to close the tab after extraction
                      }, function(response) {
                        if (response && response.success) {
                          console.log(`DEXScreener Extractor: Auto-extracted ${response.count} rows`);
                          // Close the tab after a delay to ensure data is sent
                          setTimeout(function() {
                            chrome.tabs.remove(tab.id);
                          }, 5000);
                        } else {
                          console.log('DEXScreener Extractor: Failed to extract data from new tab');
                        }
                      });
                    }, 5000); // Give the page 5 seconds to reload
                  });
                }, 10000); // Give it 10 seconds for initial load
              });
            }
          });
        }
      });
    }
  });
  
  // Initialize on installation
  chrome.runtime.onInstalled.addListener(function() {
    // Set default settings if not already set
    chrome.storage.local.get(['autoExtractEnabled', 'extractInterval', 'webhookUrl'], function(result) {
      let settingsUpdated = false;
      const newSettings = {};
      
      if (result.autoExtractEnabled === undefined) {
        newSettings.autoExtractEnabled = true;
        settingsUpdated = true;
      }
      
      if (!result.extractInterval) {
        newSettings.extractInterval = 60 * 60 * 1000; // 1 hour in milliseconds
        settingsUpdated = true;
      }
      
      if (!result.webhookUrl) {
        newSettings.webhookUrl = "http://localhost:3000/webhook";
        settingsUpdated = true;
      }
      
      if (settingsUpdated) {
        chrome.storage.local.set(newSettings, function() {
          console.log('DEXScreener Extractor: Default settings initialized');
          setupAlarm();
        });
      } else {
        setupAlarm();
      }
    });
  });
  
  // Listen for setting changes
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local') {
      if (changes.autoExtractEnabled || changes.extractInterval) {
        console.log('DEXScreener Extractor: Settings changed, updating alarm');
        setupAlarm();
      }
    }
  });