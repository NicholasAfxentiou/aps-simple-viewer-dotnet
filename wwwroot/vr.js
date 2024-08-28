export function startVRSession(viewer) {
    console.log('Checking WebXR support...');
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            if (supported) {
                console.log('WebXR supported. Requesting VR session...');
                navigator.xr.requestSession('immersive-vr').then(session => {
                    session.addEventListener('end', () => {
                        console.log('VR session ended');
                    });

                    viewer.loadExtension('Autodesk.Viewing.WebVR').then(vrExtension => {
                        if (vrExtension) {
                            console.log('Activating VR extension...');
                            vrExtension.activate();
                            console.log('VR session started.');

                            monitorPerformance(viewer);
                        } else {
                            console.error('VR extension is not available.');
                            alert('VR extension is not available.');
                        }
                    }).catch(err => {
                        console.error('Error starting VR extension:', err);
                        alert('Failed to start VR extension. Error: ' + err.message);
                    });

                }).catch(err => {
                    console.error('Error requesting VR session:', err);
                    alert('Failed to start VR session. Error: ' + err.message);
                });
            } else {
                alert('Immersive VR not supported on this device.');
            }
        }).catch(err => {
            console.error('Error checking VR support:', err);
            alert('Failed to check VR support. Error: ' + err.message);
        });
    } else {
        alert('WebXR not supported by your browser.');
    }
}

function monitorPerformance(viewer) {
    console.log('Starting performance monitoring...');
    
    function logPerformance() {
        const memory = performance.memory;
        if (memory) {
            console.log(`Memory used: ${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
            console.log(`Total JS heap size: ${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`);
        }
        
        const fps = viewer.impl.renderer().getFPS();
        console.log(`FPS: ${fps}`);
        
        setTimeout(logPerformance, 5000);
    }
    
    logPerformance();
}
