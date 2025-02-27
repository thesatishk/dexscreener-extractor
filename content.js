// Variables
let extractButton;
let statusDisplay;
let webhookUrl = "http://localhost:3000/webhook"; // Default webhook URL
let autoExtractEnabled = true; // Default to enabled
let extractInterval = 60 * 60 * 1000; // 1 hour in milliseconds
let extractIntervalId = null;
let isPanelVisible = true; // New variable to track panel visibility

// Create UI elements
function createUIElements() {
  // Create container
  const container = document.createElement('div');
  container.id = 'dexscreener-control-panel'; // Add ID for easy selection
  container.style.position = 'fixed';
  container.style.top = '10px';
  container.style.right = '10px';
  container.style.zIndex = '9999';
  container.style.backgroundColor = '#f8f9fa';
  container.style.padding = '10px';
  container.style.borderRadius = '5px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  container.style.display = isPanelVisible ? 'flex' : 'none'; // Add this line
  container.style.flexDirection = 'column';
  container.style.gap = '10px';
  
  // Create extract button
  extractButton = document.createElement('button');
  extractButton.textContent = 'Extract Now';
  extractButton.style.padding = '8px 12px';
  extractButton.style.backgroundColor = '#4CAF50';
  extractButton.style.color = 'white';
  extractButton.style.border = 'none';
  extractButton.style.borderRadius = '4px';
  extractButton.style.cursor = 'pointer';
  
  // Create auto-extract toggle button
  const autoExtractButton = document.createElement('button');
  updateAutoExtractButtonText();
  
  function updateAutoExtractButtonText() {
    autoExtractButton.textContent = autoExtractEnabled ? 'Auto-Extract: ON' : 'Auto-Extract: OFF';
    autoExtractButton.style.backgroundColor = autoExtractEnabled ? '#2196F3' : '#9E9E9E';
  }
  
  autoExtractButton.style.padding = '8px 12px';
  autoExtractButton.style.color = 'white';
  autoExtractButton.style.border = 'none';
  autoExtractButton.style.borderRadius = '4px';
  autoExtractButton.style.cursor = 'pointer';
  autoExtractButton.style.marginTop = '5px';
  
  autoExtractButton.addEventListener('click', () => {
    autoExtractEnabled = !autoExtractEnabled;
    updateAutoExtractButtonText();
    
    if (autoExtractEnabled) {
      startAutoExtract();
      statusDisplay.textContent = `Auto-extract enabled. Next extraction in 1 hour.`;
    } else {
      stopAutoExtract();
      statusDisplay.textContent = `Auto-extract disabled.`;
    }
    
    // Save the preference
    chrome.storage.local.set({ autoExtractEnabled });
  });
  
  // Create status display
  statusDisplay = document.createElement('div');
  statusDisplay.textContent = autoExtractEnabled ? 'Auto-extract enabled. Waiting for next cycle.' : 'Ready';
  statusDisplay.style.fontSize = '12px';
  statusDisplay.style.marginTop = '5px';
  
  // Add time indicator
  const nextExtractTime = document.createElement('div');
  nextExtractTime.id = 'next-extract-time';
  nextExtractTime.style.fontSize = '11px';
  nextExtractTime.style.color = '#666';
  nextExtractTime.style.marginTop = '3px';
  
  // Add elements to container
  container.appendChild(extractButton);
  container.appendChild(autoExtractButton);
  container.appendChild(statusDisplay);
  container.appendChild(nextExtractTime);
  
  // Add container to page
  document.body.appendChild(container);
  
  // Add event listener
  extractButton.addEventListener('click', extractAndSendData);
}

// Extract data from the DEXScreener table
// Extract data from the table
// Extract data from the table
function extractTableData() {
    const rows = Array.from(document.querySelectorAll('.ds-dex-table-row-col-token'));
    console.log('Found token rows:', rows.length);
    
    return rows.map(row => {
      try {
        // Look for the parent row
        const parentRow = row.closest('.ds-dex-table-row-top');
        
        // Extract token symbol (base/quote format)
        const baseTokenSymbol = row.querySelector('.ds-dex-table-row-base-token-symbol')?.textContent.trim() || '';
        const quoteTokenSymbol = row.querySelector('.ds-dex-table-row-quote-token-symbol')?.textContent.trim() || '';
        const tokenSymbol = baseTokenSymbol && quoteTokenSymbol ? `${baseTokenSymbol}/${quoteTokenSymbol}` : 'Unknown';
        
        // Extract token name
        const tokenName = row.querySelector('.ds-dex-table-row-base-token-name-text')?.textContent.trim() || '';
        
        // Find the DEX icon directly in the parent row, not in a specific cell
        let dexName = 'Unknown';
        if (parentRow) {
          const dexIcon = parentRow.querySelector('.ds-dex-table-row-dex-icon');
          if (dexIcon && dexIcon.getAttribute('title')) {
            dexName = dexIcon.getAttribute('title');
            console.log(`Found DEX: ${dexName} for token: ${tokenSymbol}`);
          }
        }
        
        // Find all data cells in the row or parent row
        const dataCells = parentRow ? Array.from(parentRow.querySelectorAll('.ds-table-data-cell')) : [];
        console.log(`Found ${dataCells.length} data cells for ${tokenSymbol}`);
        
        const pairUrl = parentRow.href
        // Map specific data cells to their values
        // This may need adjustment based on the actual structure
        return {
          tokenSymbol: tokenSymbol || 'Unknown',
          tokenName: tokenName || '',
          dexName: dexName,
          price: findCellValueByIndex(dataCells, 1) || '',
          age: findCellValueByIndex(dataCells, 2) || '',
          txns: findCellValueByIndex(dataCells, 3) || '',
          volume: findCellValueByIndex(dataCells, 4) || '',
          makers: findCellValueByIndex(dataCells, 5) || '',
          change5m: findCellValueByIndex(dataCells, 6) || '',
          change1h: findCellValueByIndex(dataCells, 7) || '',
          change6h: findCellValueByIndex(dataCells, 8) || '',
          change24h: findCellValueByIndex(dataCells, 9) || '',
          liquidity: findCellValueByIndex(dataCells, 10) || '',
          mcap: findCellValueByIndex(dataCells, 11) || '',
          pairUrl: pairUrl
        };
      } catch (error) {
        console.error('Error processing row:', error);
        return {
          tokenSymbol: 'Error',
          tokenName: '',
          dexName: 'Unknown',
          price: '',
          age: '',
          txns: '',
          volume: '',
          makers: '',
          change5m: '',
          change1h: '',
          change6h: '',
          change24h: '',
          liquidity: '',
          mcap: '',
          pairUrl: ''
        };
      }
    });
  }
  
  // Helper function to get cell value by index, safely
  function findCellValueByIndex(cells, index) {
    if (!cells || index >= cells.length) return '';
    return cells[index]?.textContent.trim() || '';
  }


// Send data to webhook
function sendToWebhook(data, isAutomatic = false) {
  if (!isAutomatic) {
    statusDisplay.textContent = 'Sending data...';
  }
  
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      source: window.location.href,
      data: data,
      isAutomatic: isAutomatic
    }),
  })
  .then(response => {
    if (response.ok) {
      const successMessage = isAutomatic ? 
        `Auto-extraction successful (${data.length} rows) at ${new Date().toLocaleTimeString()}` : 
        'Data sent successfully!';
      
      statusDisplay.textContent = successMessage;
      statusDisplay.style.color = 'green';
      
      // Update next extraction time display if automatic
      if (isAutomatic) {
        updateNextExtractionTime();
      }
    } else {
      throw new Error(`Server responded with ${response.status}`);
    }
  })
  .catch(error => {
    console.error('Error sending data:', error);
    statusDisplay.textContent = isAutomatic ? 
      `Auto-extraction error: ${error.message}` : 
      `Error: ${error.message}`;
    statusDisplay.style.color = 'red';
  });
}

// Save data locally if webhook fails
function saveDataLocally(data) {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `dexscreener_data_${new Date().toISOString().replace(/:/g, '-')}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// Function to refresh the page before extraction
function refreshAndExtract(isAutomatic = false) {
  if (!isAutomatic && statusDisplay) {
    statusDisplay.textContent = 'Refreshing page...';
    statusDisplay.style.color = 'blue';
  }
  
  // Use reload API if this is called from the background script
  // Otherwise just reload the page the normal way
  if (window.location.reload) {
    window.location.reload();
    // The page will reload, so this function will not continue
    // The extraction will need to be triggered again after reload
  }
}

// Main function to extract and send data
function extractAndSendData(isAutomatic = false) {
  if (!isAutomatic) {
    extractButton.disabled = true;
  }
  
  if (statusDisplay) {
    statusDisplay.textContent = 'Extracting data...';
    statusDisplay.style.color = 'blue';
  }
  
  try {
    const data = extractTableData();
    
    if (data.length === 0) {
      statusDisplay.textContent = 'No data found in table!';
      statusDisplay.style.color = 'red';
      if (!isAutomatic) extractButton.disabled = false;
      return;
    }
    
    const timestamp = new Date().toISOString();
    statusDisplay.textContent = `Extracted ${data.length} rows at ${new Date().toLocaleTimeString()}. Sending...`;
    
    // If it's a manual extraction, show the save button
    if (!isAutomatic) {
      // Check if save button already exists
      let saveButton = document.querySelector('.save-data-locally');
      
      if (!saveButton) {
        // Option to save locally
        saveButton = document.createElement('button');
        saveButton.className = 'save-data-locally';
        saveButton.textContent = 'Save Data Locally';
        saveButton.style.padding = '6px 10px';
        saveButton.style.backgroundColor = '#2196F3';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '4px';
        saveButton.style.marginTop = '5px';
        saveButton.style.cursor = 'pointer';
        
        saveButton.addEventListener('click', () => saveDataLocally(data));
        
        const nextExtractTimeElement = document.getElementById('next-extract-time');
        if (nextExtractTimeElement) {
          extractButton.parentNode.insertBefore(saveButton, nextExtractTimeElement);
        } else {
          extractButton.parentNode.insertBefore(saveButton, statusDisplay.nextSibling);
        }
      }
    }
    
    // Send to webhook
    sendToWebhook(data, isAutomatic);
    
    // Log extraction for tracking
    const extractionRecord = {
      timestamp,
      rowsExtracted: data.length,
      isAutomatic
    };
    
    chrome.storage.local.get(['extractionHistory'], function(result) {
      let history = result.extractionHistory || [];
      history.push(extractionRecord);
      
      // Keep only the last 100 extractions to avoid excessive storage
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      chrome.storage.local.set({ extractionHistory: history });
    });
    
    if (!isAutomatic) extractButton.disabled = false;
  } catch (error) {
    console.error('Error extracting data:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
    statusDisplay.style.color = 'red';
    if (!isAutomatic) extractButton.disabled = false;
  }
}

// Handle messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extract") {
    const isAutomatic = !!message.autoClose; // If autoClose is set, it's from background script
    extractAndSendData(isAutomatic);
    
    // Wait a bit to make sure data is extracted and sent before responding
    setTimeout(() => {
      const rowCount = extractTableData().length;
      sendResponse({success: true, count: rowCount});
    }, 2000);
    
    return true; // Indicates we'll respond asynchronously
  } else if (message.action === "refresh") {
    // Handle page refresh request
    refreshAndExtract(false);
    sendResponse({success: true, message: "Page refresh initiated"});
    return false; // No async response needed
  } else if (message.action === "updateWebhook" && message.webhookUrl) {
    webhookUrl = message.webhookUrl;
    if (statusDisplay) {
      statusDisplay.textContent = 'Webhook URL updated';
    }
    sendResponse({success: true});
    return true;
  } else if (message.action === "updateAutoExtract") {
    autoExtractEnabled = message.enabled;
    
    if (autoExtractEnabled) {
      startAutoExtract();
      if (statusDisplay) {
        statusDisplay.textContent = `Auto-extract enabled. Next extraction in ${extractInterval / (60 * 1000)} minutes.`;
      }
    } else {
      stopAutoExtract();
      if (statusDisplay) {
        statusDisplay.textContent = `Auto-extract disabled.`;
      }
    }
    
    sendResponse({success: true, autoExtractEnabled});
    return true;
  } else if (message.action === "updateExtractInterval") {
    extractInterval = message.interval;
    
    // If auto-extract is enabled, restart the interval with the new time
    if (autoExtractEnabled) {
      stopAutoExtract();
      startAutoExtract();
      if (statusDisplay) {
        statusDisplay.textContent = `Extract interval updated to ${extractInterval / (60 * 1000)} minutes.`;
      }
    }
    
    sendResponse({success: true, extractInterval});
    return true;
  } else if (message.action === "getStatus") {
    sendResponse({
      success: true,
      autoExtractEnabled,
      extractInterval,
      webhookUrl,
      nextExtraction: extractIntervalId ? new Date(Date.now() + extractInterval).toLocaleTimeString() : null
    });
    return true;
  }
});

// Add popup for setting webhook URL
function addSettingsButton() {
  const settingsButton = document.createElement('button');
  settingsButton.textContent = '⚙️';
  settingsButton.style.position = 'fixed';
  settingsButton.style.top = '10px';
  settingsButton.style.right = '220px';
  settingsButton.style.zIndex = '9999';
  settingsButton.style.borderRadius = '50%';
  settingsButton.style.width = '30px';
  settingsButton.style.height = '30px';
  settingsButton.style.backgroundColor = '#f8f9fa';
  settingsButton.style.border = '1px solid #ddd';
  settingsButton.style.cursor = 'pointer';
  
  settingsButton.addEventListener('click', () => {
    const newUrl = prompt('Enter webhook URL:', webhookUrl);
    if (newUrl) {
      webhookUrl = newUrl;
      statusDisplay.textContent = 'Webhook URL updated';
    }
  });
  
  document.body.appendChild(settingsButton);
}

// Function to start auto extraction
function startAutoExtract() {
  // Clear any existing interval
  stopAutoExtract();
  
  // Set new interval
  extractIntervalId = setInterval(() => {
    extractAndSendData(true); // true indicates this is an automated extraction
    updateNextExtractionTime();
  }, extractInterval);
  
  updateNextExtractionTime();
}

// Function to stop auto extraction
function stopAutoExtract() {
  if (extractIntervalId) {
    clearInterval(extractIntervalId);
    extractIntervalId = null;
    
    const nextExtractTimeElement = document.getElementById('next-extract-time');
    if (nextExtractTimeElement) {
      nextExtractTimeElement.textContent = 'Auto-extract disabled';
    }
  }
}

// Update the next extraction time display
function updateNextExtractionTime() {
  if (!autoExtractEnabled) return;
  
  const nextExtractTimeElement = document.getElementById('next-extract-time');
  if (nextExtractTimeElement) {
    const now = new Date();
    const nextExtraction = new Date(now.getTime() + extractInterval);
    const timeString = nextExtraction.toLocaleTimeString();
    nextExtractTimeElement.textContent = `Next extraction at: ${timeString}`;
  }
}

// Add new function to create toggle button
function createToggleButton() {
  const toggleButton = document.createElement('button');
  toggleButton.textContent = '🔽';
  toggleButton.style.position = 'fixed';
  toggleButton.style.top = '10px';
  toggleButton.style.right = '260px';
  toggleButton.style.zIndex = '9999';
  toggleButton.style.borderRadius = '50%';
  toggleButton.style.width = '30px';
  toggleButton.style.height = '30px';
  toggleButton.style.backgroundColor = '#f8f9fa';
  toggleButton.style.border = '1px solid #ddd';
  toggleButton.style.cursor = 'pointer';
  
  toggleButton.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    toggleButton.textContent = isPanelVisible ? '🔽' : '🔼';
    const container = document.querySelector('#dexscreener-control-panel');
    if (container) {
      container.style.display = isPanelVisible ? 'flex' : 'none';
    }
    // Save preference
    chrome.storage.local.set({ isPanelVisible });
  });
  
  document.body.appendChild(toggleButton);
}

// Initialize when page is fully loaded
window.addEventListener('load', () => {
  // Wait a bit to ensure the page is fully loaded and data is rendered
  setTimeout(() => {
    createToggleButton(); // Add this line before createUIElements
    createUIElements();
    addSettingsButton();
    
    // Check if settings have been set via storage
    chrome.storage.local.get([
      'webhookUrl', 
      'autoExtractEnabled', 
      'extractInterval',
      'isPanelVisible'  // Add this line
    ], function(result) {
      if (result.webhookUrl) {
        webhookUrl = result.webhookUrl;
      }
      
      if (result.autoExtractEnabled !== undefined) {
        autoExtractEnabled = result.autoExtractEnabled;
      }
      
      if (result.extractInterval) {
        extractInterval = result.extractInterval;
      }
      
      if (result.isPanelVisible !== undefined) {
        isPanelVisible = result.isPanelVisible;
        const container = document.querySelector('#dexscreener-control-panel');
        const toggleButton = document.querySelector('#panel-toggle-button');
        if (container) {
          container.style.display = isPanelVisible ? 'flex' : 'none';
        }
        if (toggleButton) {
          toggleButton.textContent = isPanelVisible ? '🔽' : '🔼';
        }
      }
      
      // Start auto-extract if enabled
      if (autoExtractEnabled) {
        startAutoExtract();
      }
      
      // Do an initial extraction if auto-extract is enabled
      if (autoExtractEnabled) {
        // Wait a bit more for the page to be fully loaded
        setTimeout(() => {
          extractAndSendData(true);
        }, 2000);
      }
    });
  }, 3000); // Increased timeout to ensure dynamic content is loaded
});

// Listen for page changes (for single-page applications)
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Wait for new page content to load
    setTimeout(() => {
      const data = extractTableData();
      if (data.length > 0) {
        statusDisplay.textContent = `Found ${data.length} rows on new page`;
      }
    }, 3000);
  }
}).observe(document, {subtree: true, childList: true});