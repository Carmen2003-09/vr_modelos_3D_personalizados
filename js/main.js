
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from '../VR/VRButton.js';

const manager = new THREE.LoadingManager();

let camera, scene, renderer, stats, object, loader, guiMorphsFolder, controls;
let mixer;
let sceneContainer;
let modelEyeHeight = 1.6; // Altura de los ojos en metros (altura por defecto)

const clock = new THREE.Clock();

const params = {
    asset: 'Aula1'
};

const assets = [
    'Aula1',
    'Samba Dancing',
    'morph_test',
    'monkey',
    'monkey_embedded_texture',
    'vCube',
];


init();

function init() {

    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(0, 10, 30);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);
    
    // Crear un grupo contenedor para ajustar la altura en VR
    sceneContainer = new THREE.Group();
    sceneContainer.name = 'SceneContainer';
    scene.add(sceneContainer);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = - 100;
    dirLight.shadow.camera.left = - 120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

    // ground
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    sceneContainer.add(mesh);

    const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    sceneContainer.add(grid);

    loader = new FBXLoader(manager);
    loadAsset(params.asset);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Habilitar WebXR para VR
    renderer.xr.enabled = true;

    // Agregar botón VR
    const vrButton = VRButton.createButton(renderer);
    document.body.appendChild(vrButton);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Deshabilitar controles cuando esté en VR y ajustar altura de la cámara
    renderer.xr.addEventListener('sessionstart', () => {
        controls.enabled = false;
        
        // Ajustar la altura de la cámara en VR basándome en el tamaño del modelo
        // modelEyeHeight se calcula cuando se carga el modelo (especialmente para Aula1)
        // Representa la altura de los ojos de una persona (1.6m) ajustada al tamaño del modelo
        
        // Mover el contenedor de la escena hacia abajo para que la cámara esté a la altura deseada
        // Esto hace que cuando la cámara VR esté en Y=0 (suelo), vea el modelo a la altura de los ojos
        sceneContainer.position.y = -modelEyeHeight;
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        controls.enabled = true;
        
        // Restaurar la posición original cuando se sale de VR
        sceneContainer.position.y = 0;
    });

    window.addEventListener('resize', onWindowResize);

    // stats
    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange(function (value) {

        loadAsset(value);

    });

    guiMorphsFolder = gui.addFolder('Morphs').hide();

}

function loadAsset(asset) {

    loader.load('models/fbx/' + asset + '.fbx', function (group) {

        if (object) {

            object.traverse(function (child) {

                if (child.isSkinnedMesh) {

                    child.skeleton.dispose();

                }

                if (child.material) {

                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {

                        if (material.map) material.map.dispose();
                        material.dispose();

                    });

                }

                if (child.geometry) child.geometry.dispose();

            });

            scene.remove(object);

        }

        //

        object = group;

        if (object.animations && object.animations.length) {

            mixer = new THREE.AnimationMixer(object);

            const action = mixer.clipAction(object.animations[0]);
            action.play();

        } else {

            mixer = null;

        }

        guiMorphsFolder.children.forEach((child) => child.destroy());
        guiMorphsFolder.hide();

        object.traverse(function (child) {

            if (child.isMesh) {

                child.castShadow = true;
                child.receiveShadow = true;

                if (child.morphTargetDictionary) {

                    guiMorphsFolder.show();
                    const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);
                    Object.keys(child.morphTargetDictionary).forEach((key) => {

                        meshFolder.add(child.morphTargetInfluences, child.morphTargetDictionary[key], 0, 1, 0.01);

                    });

                }

            }

        });

        sceneContainer.add(object);

        // Ajustar escala y cámara para el aula si es el modelo Aula o Aula1
        if (asset === 'Aula' || asset === 'Aula1') {
            // Escalar el modelo para mejor visualización
            const scale = 20;
            object.scale.set(scale, scale, scale);
            
            // Asegurar que el modelo no tenga rotaciones no deseadas
            object.rotation.set(0, 0, 0);
            
            // Calcular el bounding box del modelo escalado
            const box = new THREE.Box3().setFromObject(object);
            const min = box.min;
            const max = box.max;
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Ajustar la posición Y del modelo para que el piso quede en Y=0
            // El punto más bajo del modelo debe estar en el plano del suelo
            const yOffset = -min.y;
            object.position.y = yOffset;
            
            // Centrar el modelo en X y Z si es necesario
            object.position.x = -center.x;
            object.position.z = -center.z;
            
            // Recalcular el bounding box después del ajuste de posición
            box.setFromObject(object);
            const newCenter = box.getCenter(new THREE.Vector3());
            const newSize = box.getSize(new THREE.Vector3());
            
            // Calcular la altura de los ojos basándome en el tamaño del modelo
            // La altura de los ojos de una persona promedio es ~1.6m
            // Si el modelo está escalado, calculamos qué altura representa 1.6m en el espacio del modelo
            // Usamos el tamaño Y del modelo como referencia para calcular la escala
            // Asumimos que un aula típica tiene ~3m de altura, así que ajustamos proporcionalmente
            const typicalRoomHeight = 3.0; // Altura típica de un aula en metros
            const eyeHeightInRealWorld = 1.6; // Altura de los ojos en el mundo real (metros)
            
            // Si el modelo tiene una altura razonable (entre 2-10 metros en el espacio 3D),
            // usamos esa altura como referencia. Si es muy grande o muy pequeño, usamos la altura estándar.
            if (newSize.y > 0.1 && newSize.y < 100) {
                // Calcular la altura de los ojos proporcional al tamaño del modelo
                // Si el modelo tiene newSize.y de altura, y representa typicalRoomHeight metros,
                // entonces eyeHeightInRealWorld metros = (eyeHeightInRealWorld / typicalRoomHeight) * newSize.y
                const scaleFactor = newSize.y / typicalRoomHeight;
                modelEyeHeight = eyeHeightInRealWorld * scaleFactor;
            } else {
                // Si el modelo tiene un tamaño inusual, usar altura estándar
                modelEyeHeight = eyeHeightInRealWorld;
            }
            
            // Agregar ventanas adicionales al aula (usar el nuevo centro)
            if (asset === 'Aula') {
                addWindowsToAula(object, newCenter, newSize, scale);
            }
            
            // Ajustar cámara para estar dentro del aula escalada
            // Posición dentro del aula (aproximadamente en el centro del espacio)
            const cameraHeight = newCenter.y + newSize.y * 0.3; // A la altura de una persona
            camera.position.set(
                newCenter.x + newSize.x * 0.2,   // Ligeramente hacia un lado
                cameraHeight,                    // A la altura de una persona (aproximadamente 1.5-2m)
                newCenter.z + newSize.z * 0.3    // Hacia el interior del aula
            );
            
            // Mirar hacia el centro del aula
            controls.target.set(newCenter.x, newCenter.y + newSize.y * 0.2, newCenter.z);
            controls.update();
        }

    });

}

function addWindowsToAula(aulaObject, center, size, scale) {
    // Crear un grupo para las ventanas
    const windowsGroup = new THREE.Group();
    windowsGroup.name = 'Windows';
    
    // Dimensiones de las ventanas
    const windowWidth = 2 * scale;  // Ancho de la ventana
    const windowHeight = 1.5 * scale; // Alto de la ventana
    const frameThickness = 0.1 * scale; // Grosor del marco
    const glassThickness = 0.05 * scale; // Grosor del vidrio
    
    // Materiales
    const frameMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513, // Color marrón para el marco
        shininess: 30 
    });
    
    const glassMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x87CEEB, // Color azul claro para el vidrio
        transparent: true,
        opacity: 0.3,
        shininess: 100,
        side: THREE.DoubleSide
    });
    
    // Función para crear una ventana
    function createWindow(position, rotation) {
        const windowGroup = new THREE.Group();
        
        // Marco exterior (rectángulo)
        const frameGeometry = new THREE.BoxGeometry(
            windowWidth + frameThickness * 2,
            windowHeight + frameThickness * 2,
            frameThickness
        );
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -frameThickness / 2;
        frame.castShadow = true;
        frame.receiveShadow = true;
        windowGroup.add(frame);
        
        // Marco interior (hueco)
        const innerFrameGeometry = new THREE.BoxGeometry(
            windowWidth,
            windowHeight,
            frameThickness * 0.5
        );
        const innerFrame = new THREE.Mesh(innerFrameGeometry, frameMaterial);
        innerFrame.position.z = -frameThickness * 0.75;
        innerFrame.castShadow = true;
        innerFrame.receiveShadow = true;
        windowGroup.add(innerFrame);
        
        // Vidrio
        const glassGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.z = -frameThickness * 0.25;
        glass.receiveShadow = true;
        windowGroup.add(glass);
        
        // Posicionar la ventana
        windowGroup.position.copy(position);
        windowGroup.rotation.copy(rotation);
        
        return windowGroup;
    }
    
    // Agregar ventanas en diferentes paredes
    // Ventana en la pared frontal (frente del aula)
    const window1 = createWindow(
        new THREE.Vector3(center.x - size.x * 0.25, center.y + size.y * 0.2, center.z - size.z * 0.5),
        new THREE.Euler(0, 0, 0)
    );
    windowsGroup.add(window1);
    
    // Ventana en la pared lateral izquierda
    const window2 = createWindow(
        new THREE.Vector3(center.x - size.x * 0.5, center.y + size.y * 0.2, center.z),
        new THREE.Euler(0, Math.PI / 2, 0)
    );
    windowsGroup.add(window2);
    
    // Ventana en la pared lateral derecha
    const window3 = createWindow(
        new THREE.Vector3(center.x + size.x * 0.5, center.y + size.y * 0.2, center.z),
        new THREE.Euler(0, -Math.PI / 2, 0)
    );
    windowsGroup.add(window3);
    
    // Ventana adicional en la pared frontal (lado opuesto)
    const window4 = createWindow(
        new THREE.Vector3(center.x + size.x * 0.25, center.y + size.y * 0.2, center.z - size.z * 0.5),
        new THREE.Euler(0, 0, 0)
    );
    windowsGroup.add(window4);
    
    // Agregar el grupo de ventanas al objeto del aula
    aulaObject.add(windowsGroup);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

//

function animate() {

    const delta = clock.getDelta();

    if (mixer) mixer.update(delta);

    renderer.render(scene, camera);

    stats.update();

}