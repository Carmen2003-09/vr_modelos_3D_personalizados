
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRButton } from '../VR/VRButton.js';

const manager = new THREE.LoadingManager();

let camera, scene, renderer, stats, object, loader, controls;
let mixer;
let sceneContainer;
let modelEyeHeight = 1.6; // Altura de los ojos en metros (altura por defecto)

const clock = new THREE.Clock();

init();

function init() {

    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    // Posición inicial: vista externa elevada mirando hacia abajo
    camera.position.set(15, 20, 25);

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
    // Configurar el path base para el archivo FBX
    loader.setPath('models/fbx/');
    // Configurar el path de texturas para que apunte a la carpeta casa_final_2
    loader.resourcePath = 'models/fbx/casa_final_2/';
    
    // Crear un TextureLoader adicional para cargar texturas manualmente si es necesario
    const textureLoader = new THREE.TextureLoader(manager);
    textureLoader.setPath('models/fbx/casa_final_2/');
    
    loadAsset('casa_final_2', textureLoader);

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
    // Target inicial: punto central donde estará el modelo
    controls.target.set(0, 5, 0);
    controls.update();
    
    // Variables para almacenar posiciones antes de entrar a VR
    let savedCameraPosition = new THREE.Vector3();
    let savedControlsTarget = new THREE.Vector3();
    let savedSceneContainerY = 0;
    
    // Deshabilitar controles cuando esté en VR y ajustar altura de la cámara
    renderer.xr.addEventListener('sessionstart', () => {
        // Guardar la posición actual de la cámara y controles antes de entrar a VR
        savedCameraPosition.copy(camera.position);
        savedControlsTarget.copy(controls.target);
        savedSceneContainerY = sceneContainer.position.y;
        
        // Deshabilitar controles de órbita en VR
        controls.enabled = false;
        
        // Ajustar la altura de la cámara en VR para que esté a la altura de los ojos
        // En VR, la cámara comienza en Y=0 (suelo físico del usuario)
        // Necesitamos mover la escena hacia abajo para que cuando la cámara esté en Y=0,
        // vea el modelo a la altura de los ojos (1.6m desde el piso del modelo)
        
        // La altura de los ojos es 1.6 metros desde el piso del modelo
        const eyeHeight = 1.6;
        
        // Mover el contenedor de la escena hacia abajo
        // Esto hace que cuando la cámara VR esté en Y=0, vea el modelo a la altura de los ojos
        sceneContainer.position.y = -eyeHeight;
        
        console.log('VR iniciado - Altura de ojos configurada a 1.6m desde el piso del modelo');
    });
    
    renderer.xr.addEventListener('sessionend', () => {
        // Restaurar la posición original de la escena cuando se sale de VR
        sceneContainer.position.y = savedSceneContainerY;
        
        // Restaurar la posición de la cámara y el target de los controles
        camera.position.copy(savedCameraPosition);
        controls.target.copy(savedControlsTarget);
        controls.update();
        
        // Rehabilitar controles de órbita
        controls.enabled = true;
        
        console.log('VR finalizado - Posición de escena y cámara restauradas para observación externa');
    });

    window.addEventListener('resize', onWindowResize);

    // stats
    stats = new Stats();
    container.appendChild(stats.dom);

}

function loadAsset(asset, textureLoader) {

    loader.load(asset + '.fbx', function (group) {

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

        // TextureLoader para cargar texturas manualmente si es necesario
        const manualTextureLoader = textureLoader || new THREE.TextureLoader(manager);
        manualTextureLoader.setPath('models/fbx/casa_final_2/');

        // Función para extraer el nombre del archivo de textura de una ruta
        function getTextureFileName(path) {
            if (!path) return null;
            const parts = path.split(/[/\\]/);
            return parts[parts.length - 1];
        }

        // Función para intentar cargar una textura desde la carpeta casa_final
        function loadTextureFromFolder(fileName, material, property = 'map') {
            if (!fileName) return;
            
            // Limpiar el nombre del archivo (remover rutas relativas)
            const cleanFileName = getTextureFileName(fileName);
            if (!cleanFileName) return;
            
            try {
                manualTextureLoader.load(cleanFileName,
                    function(texture) {
                        // Configurar propiedades de la textura
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.flipY = false;
                        
                        // Aplicar la textura al material
                        if (property === 'map') {
                            material.map = texture;
                        } else if (property === 'normalMap') {
                            material.normalMap = texture;
                        }
                        
                        material.needsUpdate = true;
                        console.log('Textura cargada:', cleanFileName, 'para material:', material.name);
                    },
                    undefined,
                    function(error) {
                        console.warn('No se pudo cargar la textura:', cleanFileName, error);
                    }
                );
            } catch (e) {
                console.warn('Error al intentar cargar textura:', cleanFileName, e);
            }
        }

        object.traverse(function (child) {

            if (child.isMesh) {

                child.castShadow = true;
                child.receiveShadow = true;

                // Verificar y corregir texturas del material
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    
                    materials.forEach(material => {
                        if (!material) return;
                        
                        // Verificar si el material tiene una textura que no se cargó correctamente
                        if (material.map) {
                            // Si la textura existe pero no tiene imagen cargada, intentar recargarla
                            if (!material.map.image || material.map.image.width === 0) {
                                const textureName = material.map.name || material.map.sourceFile || '';
                                if (textureName) {
                                    loadTextureFromFolder(textureName, material, 'map');
                                }
                            } else {
                                // Asegurarse de que la textura tenga las propiedades correctas
                                material.map.wrapS = THREE.RepeatWrapping;
                                material.map.wrapT = THREE.RepeatWrapping;
                                material.map.needsUpdate = true;
                            }
                        } else {
                            // Si no hay textura, intentar cargar una basada en el nombre del material o mesh
                            const materialName = (material.name || '').toLowerCase();
                            const meshName = (child.name || '').toLowerCase();
                            
                            // Determinar qué tipo de textura podría necesitarse basándose en el nombre
                            let textureToTry = null;
                            
                            // Buscar pistas en los nombres para determinar qué textura usar
                            if (meshName.includes('wall') || meshName.includes('pared') || materialName.includes('wall') || materialName.includes('pared')) {
                                textureToTry = 'Material_1.jpg';
                            } else if (meshName.includes('door') || meshName.includes('puerta') || materialName.includes('door') || materialName.includes('puerta')) {
                                textureToTry = 'wood.jpg';
                            } else if (meshName.includes('floor') || meshName.includes('piso') || materialName.includes('floor') || materialName.includes('piso')) {
                                textureToTry = 'Material_5.jpg';
                            } else {
                                // Intentar con texturas comunes
                                textureToTry = 'DefaultMaterial.jpg';
                            }
                            
                            // Intentar cargar la textura determinada
                            if (textureToTry) {
                                manualTextureLoader.load(textureToTry,
                                    function(texture) {
                                        texture.wrapS = THREE.RepeatWrapping;
                                        texture.wrapT = THREE.RepeatWrapping;
                                        texture.flipY = false;
                                        material.map = texture;
                                        material.needsUpdate = true;
                                        console.log('Textura aplicada:', textureToTry, 'a material:', material.name, 'mesh:', child.name);
                                    },
                                    undefined,
                                    function() {
                                        // Si falla, intentar con una textura por defecto
                                        if (textureToTry !== 'DefaultMaterial.jpg') {
                                            manualTextureLoader.load('DefaultMaterial.jpg',
                                                function(texture) {
                                                    texture.wrapS = THREE.RepeatWrapping;
                                                    texture.wrapT = THREE.RepeatWrapping;
                                                    texture.flipY = false;
                                                    material.map = texture;
                                                    material.needsUpdate = true;
                                                    console.log('Textura por defecto aplicada a material:', material.name);
                                                }
                                            );
                                        }
                                    }
                                );
                            }
                        }
                        
                        // Asegurarse de que el material tenga las propiedades correctas
                        material.needsUpdate = true;
                    });
                }

            }

        });

        sceneContainer.add(object);

        // Esperar un momento y luego verificar que todas las texturas se hayan cargado correctamente
        setTimeout(function() {
            console.log('Verificando texturas después de la carga...');
            let texturesFixed = 0;
            object.traverse(function(child) {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        if (material) {
                            if (material.map) {
                                // Verificar si la textura se cargó correctamente
                                if (!material.map.image || material.map.image.width === 0) {
                                    // La textura no se cargó, intentar recargarla
                                    const textureName = material.map.name || material.map.sourceFile || '';
                                    console.log('Textura no cargada encontrada:', textureName, 'para material:', material.name);
                                    if (textureName) {
                                        loadTextureFromFolder(textureName, material, 'map');
                                        texturesFixed++;
                                    }
                                } else {
                                    console.log('Textura OK:', material.map.name || 'sin nombre', 'para material:', material.name);
                                }
                            } else {
                                console.log('Material sin textura:', material.name, 'mesh:', child.name);
                            }
                        }
                    });
                }
            });
            console.log('Texturas corregidas:', texturesFixed);
        }, 1000); // Esperar 1 segundo para que el FBXLoader termine de cargar

        // Calcular el bounding box del modelo
        const box = new THREE.Box3().setFromObject(object);
        const min = box.min;
        const max = box.max;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Guardar la altura del piso del modelo antes de moverlo
        modelFloorHeight = min.y;
        
        // Ajustar la posición Y del modelo para que el piso quede en Y=0
        const yOffset = -min.y;
        object.position.y = yOffset;
        
        // Centrar el modelo en X y Z
        object.position.x = -center.x;
        object.position.z = -center.z;
        
        // Recalcular el bounding box después del ajuste de posición
        box.setFromObject(object);
        const newCenter = box.getCenter(new THREE.Vector3());
        const newSize = box.getSize(new THREE.Vector3());
        
        // La altura de los ojos es fija: 1.6 metros desde el piso del modelo
        // Esto es estándar para la altura promedio de los ojos de una persona
        modelEyeHeight = 1.6;
        
        console.log('Modelo cargado - Piso en Y=0, altura de ojos configurada a 1.6m');
        
        // Ajustar cámara para visualizar la casa desde una vista externa elevada
        // Vista desde arriba y afuera, mirando hacia abajo al interior
        const cameraDistance = Math.max(newSize.x, newSize.z, newSize.y) * 1.8;
        const cameraHeight = newCenter.y + newSize.y * 1.2; // Más elevada para vista desde arriba
        
        // Posicionar la cámara en un ángulo que permita ver el interior desde arriba
        camera.position.set(
            newCenter.x + cameraDistance * 0.5,
            cameraHeight,
            newCenter.z + cameraDistance * 0.8
        );
        
        // Mirar hacia el centro de la casa, ligeramente hacia abajo para ver el interior
        controls.target.set(newCenter.x, newCenter.y + newSize.y * 0.1, newCenter.z);
        controls.update();

    }, undefined, function (error) {
        console.error('Error al cargar el modelo:', error);
    });

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