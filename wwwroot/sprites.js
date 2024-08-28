export function addSprite(viewer, position) {
    console.log(`Adding sprite at position:`, position);
    const spriteStyle = new Autodesk.DataVisualization.Core.ViewableStyle(
        Autodesk.DataVisualization.Core.ViewableType.SPRITE, 
        new THREE.Color(0xffffff), 
        '/sensor-colored.png'  // Ensure this path is correct
    );

    const dataVizExtension = viewer.getExtension('Autodesk.DataVisualization');
    const spriteData = new Autodesk.DataVisualization.Core.SpriteViewable(position, spriteStyle);

    const viewableData = new Autodesk.DataVisualization.Core.ViewableData();
    viewableData.spriteSize = 32; // Set sprite size as needed
    viewableData.addViewable(spriteData);

    viewableData.finish().then(() => {
        dataVizExtension.addViewables(viewableData);
        console.log("Sprite added successfully.");
    }).catch(err => {
        console.error("Error adding sprite: ", err);
    });
}
