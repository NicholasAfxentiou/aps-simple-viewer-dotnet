import { initViewer, loadModel } from './viewer.js';
import { addSprite } from './sprites.js';
import { startVRSession } from './vr.js'; // Add this import at the top

let dashboardVisible = false;
let sriPlatformVisible = false;
let xrSession = null;
let xrReferenceSpace = null;

// Function to create Dashboard Iframe
function createDashboardIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = 'dashboardIframe';
    iframe.src = 'https://www.google.com/';
    iframe.style.position = 'absolute';
    iframe.style.top = '3em';
    iframe.style.right = '0';
    iframe.style.width = '368px';
    iframe.style.height = 'calc(100vh - 3em)';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = 'white';
    iframe.style.zIndex = '1000';
    iframe.style.display = dashboardVisible ? 'block' : 'none';
    document.body.appendChild(iframe);
}

// Function to create SRI Platform Iframe
function createSRIPlatformIframe() {
    const iframe = document.createElement('iframe');
    iframe.id = 'sriPlatformIframe';
    iframe.src = 'https://www.google.com/';
    iframe.style.position = 'absolute';
    iframe.style.top = '3em';
    iframe.style.right = '0';
    iframe.style.width = '500px';
    iframe.style.height = 'calc(100vh - 3em)';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = 'white';
    iframe.style.zIndex = '1000';
    iframe.style.display = sriPlatformVisible ? 'block' : 'none';
    document.body.appendChild(iframe);
}

// Function to remove Dashboard Iframe
function removeDashboardIframe() {
    const iframe = document.getElementById('dashboardIframe');
    if (iframe) {
        document.body.removeChild(iframe);
    }
}

// Function to remove SRI Platform Iframe
function removeSRIPlatformIframe() {
    const iframe = document.getElementById('sriPlatformIframe');
    if (iframe) {
        document.body.removeChild(iframe);
    }
}

// Initialize viewer and setup functionalities
initViewer(document.getElementById('preview')).then(viewer => {
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
    addCustomButtons(viewer);
    setupThreeJS();
    setupVRButton(); 
});

async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const models = await resp.json();
        dropdown.innerHTML = models.map(model => `<option value=${model.urn} ${model.urn === selectedUrn ? 'selected' : ''}>${model.name}</option>`).join('\n');
        dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
        if (dropdown.value) {
            onModelSelected(viewer, dropdown.value);
        }
    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) {
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn) {
    dashboardVisible = document.getElementById('dashboardIframe')?.style.display === 'block';
    sriPlatformVisible = document.getElementById('sriPlatformIframe')?.style.display === 'block';

    removeDashboardIframe();
    removeSRIPlatformIframe();

    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    window.location.hash = urn;
    try {
        const resp = await fetch(`/api/models/${urn}/status`);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const status = await resp.json();
        switch (status.status) {
            case 'n/a':
                showNotification(`Model has not been translated.`);
                break;
            case 'inprogress':
                showNotification(`Model is being translated (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showNotification(`Translation failed. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                clearNotification();
                loadModel(viewer, urn).then(() => {
                    const sensorNames = [
                        'Milesight Air quality sensor',
                        'Onset [688241]',
                        'Onset [688619]',
                        'Onset [689452]',
                        'Onset [689637]'
                    ];
                    findAndPlaceSensors(viewer, sensorNames);
                    
                    createDashboardIframe();
                    createSRIPlatformIframe();

                    addCustomButtons(viewer);

                    hideSprite(471651);
                });
                break;
        }
    } catch (err) {
        alert('Could not load model. See the console for more details.');
        console.error(err);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}

// Function to add custom buttons, including the VR button with WebXR support
function addCustomButtons(viewer) {
    function addButtons() {
        const toolbar = viewer.getToolbar(true);
        if (!toolbar) {
            setTimeout(addButtons, 1000);
            return;
        }

        const customControlGroup = new Autodesk.Viewing.UI.ControlGroup('customControls');
        toolbar.addControl(customControlGroup);

        const dashboardButton = new Autodesk.Viewing.UI.Button('dashboardButton');
        dashboardButton.icon.className = 'fas fa-chart-line';
        dashboardButton.icon.style.fontSize = '24px';
        dashboardButton.setToolTip('Open Dashboard');
        dashboardButton.onClick = function () {
            toggleDashboard();
        };
        customControlGroup.addControl(dashboardButton);

        const sriButton = new Autodesk.Viewing.UI.Button('sriButton');
        sriButton.icon.className = 'fas fa-tachometer-alt';
        sriButton.icon.style.fontSize = '24px';
        sriButton.setToolTip('Open SRI');
        sriButton.onClick = function () {
            toggleSRI();
        };
        customControlGroup.addControl(sriButton);

        const vrButton = new Autodesk.Viewing.UI.Button('vrButton');
        vrButton.icon.className = 'fas fa-vr-cardboard';
        vrButton.icon.style.fontSize = '24px';
        vrButton.setToolTip('Enter VR');
        vrButton.onClick = function () {
            if (xrSession) {
                endXRSession();
            } else {
                startXRSession(viewer);
            }
        };
        customControlGroup.addControl(vrButton);
    }

    addButtons();
}

function startXRSession(viewer) {
    if (navigator.xr) {
        if (xrSession) {
            endXRSession();
        }

        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            if (supported) {
                navigator.xr.requestSession('immersive-vr').then(session => {
                    xrSession = session;
                    onXRSessionStarted(viewer, session);
                }).catch(err => {
                    console.error('Error requesting XR session:', err);
                    alert('Failed to start XR session. ' + err.message);
                });
            } else {
                alert('Immersive VR not supported on this device.');
            }
        }).catch(err => {
            console.error('Error checking XR support:', err);
            alert('Failed to check XR support. ' + err.message);
        });
    } else {
        alert('WebXR not supported by your browser.');
    }
}

function onXRSessionStarted(viewer, session) {
    session.addEventListener('end', onXRSessionEnded);

    session.requestReferenceSpace('local').then(refSpace => {
        xrReferenceSpace = refSpace;
        session.requestAnimationFrame(onXRFrame);
    }).catch(err => {
        console.error('Error requesting reference space:', err);
        alert('Failed to start XR session. ' + err.message);
    });

    console.log('XR session started.');
}

function onXRFrame(time, frame) {
    if (!xrSession) return;

    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    const viewerPose = frame.getViewerPose(xrReferenceSpace);

    if (viewerPose) {
        const glLayer = session.renderState.baseLayer;
        const gl = viewer.impl.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);

        for (const view of viewerPose.views) {
            const viewport = glLayer.getViewport(view);
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);

            viewer.impl.invalidate(true, true, true);
        }
    }
}

function onXRSessionEnded(event) {
    console.log('XR session ended.');
    xrSession = null;
    xrReferenceSpace = null;
}

function endXRSession() {
    if (xrSession) {
        xrSession.end().then(() => {
            xrSession = null;
            console.log('XR session ended successfully.');
        }).catch(err => {
            console.error('Error ending XR session:', err);
        });
    }
}

function toggleDashboard() {
    const iframe = document.getElementById('dashboardIframe');
    console.log("Toggling dashboard visibility. Current state:", iframe.style.display);
    iframe.style.display = (iframe.style.display === 'none' || iframe.style.display === '') ? 'block' : 'none';
}

function toggleSRI() {
    const iframe = document.getElementById('sriPlatformIframe');
    console.log("Toggling SRI visibility. Current state:", iframe.style.display);
    iframe.style.display = (iframe.style.display === 'none' || iframe.style.display === '') ? 'block' : 'none';
}

async function findAndPlaceSensors(viewer, sensorNames) {
    for (const sensorName of sensorNames) {
        console.log(`Searching for sensor: ${sensorName}`);
        await viewer.search(sensorName, async (dbIds) => {
            if (dbIds.length > 0) {
                console.log(`Found sensor "${sensorName}" with dbIds: ${dbIds}`);

                const model = viewer.model;
                const instanceTree = model.getData().instanceTree;
                const fragmentList = model.getFragmentList();

                for (const dbId of dbIds) {
                    const fragIds = [];
                    instanceTree.enumNodeFragments(dbId, (fragId) => {
                        fragIds.push(fragId);
                    }, true);

                    if (fragIds.length > 0) {
                        console.log(`Fragment IDs for dbId ${dbId}:`, fragIds);
                        for (const fragId of fragIds) {
                            const matrix = new THREE.Matrix4();
                            fragmentList.getWorldMatrix(fragId, matrix);
                            const pos = new THREE.Vector3();
                            pos.setFromMatrixPosition(matrix);
                            console.log(`Sensor position for "${sensorName}", dbId ${dbId}, fragId ${fragId}:`, pos);
                            addSprite(viewer, pos, dbId);
                            addSpriteInteraction(viewer, dbId, pos, sensorName);
                        }
                    } else {
                        console.warn(`No fragments found for dbId ${dbId}`);
                    }
                }
            } else {
                console.warn(`Sensor "${sensorName}" not found in the model.`);
            }
        }, err => {
            console.error(`Error searching for sensor "${sensorName}":`, err);
        });
    }
}

function hideSprite(dbId) {
    const sprite = document.getElementById(`sprite-${dbId}`);
    if (sprite) {
        sprite.style.display = 'none';
    }
}

function showTooltip(sensorName, position) {
    // Remove any existing tooltips
    const existingTooltip = document.querySelector('.custom-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }

    // Create new tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    
    // Adjust position to be near the device
    const tooltipOffsetX = 20;  // Adjust this value as needed
    const tooltipOffsetY = -20; // Adjust this value as needed

    tooltip.style.position = 'absolute';
    tooltip.style.left = `${position.x + tooltipOffsetX}px`;
    tooltip.style.top = `${position.y + tooltipOffsetY}px`;
    tooltip.style.zIndex = '1001';
    tooltip.style.padding = '10px';
    tooltip.style.backgroundColor = '#fff';
    tooltip.style.border = '1px solid #ccc';
    tooltip.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    tooltip.style.borderRadius = '5px';

    if (sensorName === 'Milesight Air quality sensor') {
        tooltip.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0;">Indoor Air Quality - Details</h4>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="border: none; background: none; cursor: pointer;">&times;</button>
            </div>
            <table>
                <tr>
                    <td><i class="fa fa-cloud"></i>&nbsp;CO2 [ppm]</td>
                    <td><i class="fa fa-thermometer-half"></i>&nbsp;Temperature [°C]</td>
                </tr>
                <tr>
                    <td><i class="fa fa-tint"></i>&nbsp;Humidity [%]</td>
                    <td><i class="fa fa-leaf"></i>&nbsp;TVOC</td>
                </tr>
                <tr>
                    <td><i class="fa fa-tachometer-alt"></i>&nbsp;Pressure [hPa]</td>
                    <td><i class="fa fa-lightbulb"></i>&nbsp;Illumination [Level]</td>
                </tr>
                <tr>
                    <td><i class="fa fa-running"></i>&nbsp;Activity</td>
                    <td><i class="fa fa-battery-three-quarters"></i>&nbsp;Battery [%]</td>
                </tr>
            </table>
        `;
    } else if (['Onset [688241]', 'Onset [688619]', 'Onset [689452]', 'Onset [689637]'].includes(sensorName)) {
        tooltip.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0;">Energy Metering</h4>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="border: none; background: none; cursor: pointer;">&times;</button>
            </div>
            <table>
                <tr>
                    <td><i class="fa-solid fa-bolt"></i>&nbsp;Energy - by floor [kWh]</td>                
                </tr>
                <tr>
                    <td><i class="fa-solid fa-bolt"></i>&nbsp;Energy - by meter [kWh]</td>                
                </tr>
                <tr>
                    <td><i class="fa-solid fa-bolt"></i>&nbsp;Energy - Totals [kWh]</td>                
                </tr>
            </table>
        `;
    }

    document.body.appendChild(tooltip);
}

function addSpriteInteraction(viewer, dbId, position, sensorName) {
    viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
        const dbIdArray = event.dbIdArray;
        if (dbIdArray.includes(dbId)) {
            console.log(`Sensor "${sensorName}" selected.`);
            
            // Convert 3D position to 2D screen coordinates
            const screenPosition = viewer.worldToClient(position);

            showTooltip(sensorName, screenPosition);
        }
    });
}

document.addEventListener('click', function(event) {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip && event.target.closest('.custom-tooltip') === null) {
        tooltip.style.display = 'none';
    }
});
