/// <reference path="../../../dist/preview release/babylon.d.ts"/>

/**
 * This module hosts all controls for 2D and 3D GUIs
 * @see http://doc.babylonjs.com/how_to/gui
 */
module BABYLON.GUI {
    /**
     * Interface used to define a control that can receive focus
     */
    export interface IFocusableControl {
        /**
         * Function called when the control receives the focus
         */
        onFocus(): void;
        /**
         * Function called when the control loses the focus
         */
        onBlur(): void;
        /**
         * Function called to let the control handle keyboard events
         * @param evt defines the current keyboard event
         */
        processKeyboard(evt: KeyboardEvent): void;
    }

    /**
     * Class used to create texture to support 2D GUI elements
     * @see http://doc.babylonjs.com/how_to/gui
     */
    export class AdvancedDynamicTexture extends DynamicTexture {
        private _isDirty = false;
        private _renderObserver: Nullable<Observer<Camera>>;
        private _resizeObserver: Nullable<Observer<Engine>>;
        private _preKeyboardObserver: Nullable<Observer<KeyboardInfoPre>>;
        private _pointerMoveObserver: Nullable<Observer<PointerInfoPre>>;
        private _pointerObserver: Nullable<Observer<PointerInfo>>;
        private _canvasPointerOutObserver: Nullable<Observer<PointerEvent>>;
        private _background: string;
        /** @hidden */
        public _rootContainer = new Container("root");
        /** @hidden */
        public _lastPickedControl: Control;
        /** @hidden */
        public _lastControlOver: {[pointerId:number]:Control} = {};
        /** @hidden */
        public _lastControlDown: {[pointerId:number]:Control} = {};
        /** @hidden */
        public _capturingControl: {[pointerId:number]:Control} = {};
        /** @hidden */
        public _shouldBlockPointer: boolean;
        /** @hidden */
        public _layerToDispose: Nullable<Layer>;
        /** @hidden */
        public _linkedControls = new Array<Control>();
        private _isFullscreen = false;
        private _fullscreenViewport = new Viewport(0, 0, 1, 1);
        private _idealWidth = 0;
        private _idealHeight = 0;
        private _useSmallestIdeal: boolean = false;
        private _renderAtIdealSize = false;
        private _focusedControl: Nullable<IFocusableControl>;
        private _blockNextFocusCheck = false;
        private _renderScale = 1;

        /**
         * Gets or sets a boolean defining if alpha is stored as premultiplied
         */
        public premulAlpha = false;

        /**
         * Gets or sets a number used to scale rendering size (2 means that the texture will be twice bigger).
         * Useful when you want more antialiasing
         */
        public get renderScale(): number {
            return this._renderScale;
        }

        public set renderScale(value: number) {
            if (value === this._renderScale) {
                return;
            }

            this._renderScale = value;

            this._onResize();
        }

        /** Gets or sets the background color */
        public get background(): string {
            return this._background;
        }

        public set background(value: string) {
            if (this._background === value) {
                return;
            }

            this._background = value;
            this.markAsDirty();
        }

        /**
         * Gets or sets the ideal width used to design controls.
         * The GUI will then rescale everything accordingly
         * @see http://doc.babylonjs.com/how_to/gui#adaptive-scaling
         */
        public get idealWidth(): number {
            return this._idealWidth;
        }

        public set idealWidth(value: number) {
            if (this._idealWidth === value) {
                return;
            }

            this._idealWidth = value;
            this.markAsDirty();
            this._rootContainer._markAllAsDirty();
        }

        /**
         * Gets or sets the ideal height used to design controls.
         * The GUI will then rescale everything accordingly
         * @see http://doc.babylonjs.com/how_to/gui#adaptive-scaling
         */        
        public get idealHeight(): number {
            return this._idealHeight;
        }

        public set idealHeight(value: number) {
            if (this._idealHeight === value) {
                return;
            }

            this._idealHeight = value;
            this.markAsDirty();
            this._rootContainer._markAllAsDirty();
        }

        /**
         * Gets or sets a boolean indicating if the smallest ideal value must be used if idealWidth and idealHeight are both set
         * @see http://doc.babylonjs.com/how_to/gui#adaptive-scaling
         */
        public get useSmallestIdeal(): boolean {
            return this._useSmallestIdeal;
        }

        public set useSmallestIdeal(value: boolean) {
            if (this._useSmallestIdeal === value) {
                return;
            }

            this._useSmallestIdeal = value;
            this.markAsDirty();
            this._rootContainer._markAllAsDirty();
        }

        /**
         * Gets or sets a boolean indicating if adaptive scaling must be used
         * @see http://doc.babylonjs.com/how_to/gui#adaptive-scaling
         */
        public get renderAtIdealSize(): boolean {
            return this._renderAtIdealSize;
        }

        public set renderAtIdealSize(value: boolean) {
            if (this._renderAtIdealSize === value) {
                return;
            }

            this._renderAtIdealSize = value;
            this._onResize();
        }

        /**
         * Gets the underlying layer used to render the texture when in fullscreen mode
         */
        public get layer(): Nullable<Layer> {
            return this._layerToDispose;
        }

        /**
         * Gets the root container control
         */
        public get rootContainer(): Container {
            return this._rootContainer;
        }

        /**
         * Gets or sets the current focused control
         */
        public get focusedControl(): Nullable<IFocusableControl> {
            return this._focusedControl;
        }

        public set focusedControl(control: Nullable<IFocusableControl>) {
            if (this._focusedControl == control) {
                return;
            }

            if (this._focusedControl) {
                this._focusedControl.onBlur();
            }

            if (control) {
                control.onFocus();
            }

            this._focusedControl = control;
        }

        /**
         * Gets or sets a boolean indicating if the texture must be rendered in background or foreground when in fullscreen mode
         */
        public get isForeground(): boolean {
            if (!this.layer) {
                return true;
            }
            return (!this.layer.isBackground);
        }

        public set isForeground(value: boolean) {
            if (!this.layer) {
                return;
            }
            if (this.layer.isBackground === !value) {
                return;
            }
            this.layer.isBackground = !value;
        }

        /**
         * Creates a new AdvancedDynamicTexture
         * @param name defines the name of the texture
         * @param width defines the width of the texture
         * @param height defines the height of the texture
         * @param scene defines the hosting scene
         * @param generateMipMaps defines a boolean indicating if mipmaps must be generated (false by default)
         * @param samplingMode defines the texture sampling mode (BABYLON.Texture.NEAREST_SAMPLINGMODE by default)
         */
        constructor(name: string, width = 0, height = 0, scene: Nullable<Scene>, generateMipMaps = false, samplingMode = Texture.NEAREST_SAMPLINGMODE) {
            super(name, { width: width, height: height }, scene, generateMipMaps, samplingMode, Engine.TEXTUREFORMAT_RGBA);

            scene = this.getScene();

            if (!scene || !this._texture) {
                return;
            }

            this._renderObserver = scene.onBeforeCameraRenderObservable.add((camera: Camera) => this._checkUpdate(camera));
            this._preKeyboardObserver = scene.onPreKeyboardObservable.add(info => {
                if (!this._focusedControl) {
                    return;
                }

                if (info.type === KeyboardEventTypes.KEYDOWN) {
                    this._focusedControl.processKeyboard(info.event);
                }

                info.skipOnPointerObservable = true;
            });

            this._rootContainer._link(null, this);

            this.hasAlpha = true;

            if (!width || !height) {
                this._resizeObserver = scene.getEngine().onResizeObservable.add(() => this._onResize());
                this._onResize();
            }

            this._texture.isReady = true;
        }

        /**
         * Function used to execute a function on all controls
         * @param func defines the function to execute
         * @param container defines the container where controls belong. If null the root container will be used
         */
        public executeOnAllControls(func: (control: Control) => void, container?: Container) {
            if (!container) {
                container = this._rootContainer;
            }

            for (var child of container.children) {
                if ((<any>child).children) {
                    this.executeOnAllControls(func, (<Container>child));
                    continue;
                }
                func(child);
            }
        }

        /**
         * Marks the texture as dirty forcing a complete update
         */
        public markAsDirty() {
            this._isDirty = true;

            this.executeOnAllControls((control) => {
                if (control._isFontSizeInPercentage) {
                    control._resetFontCache();
                }
            });
        }

        /**
         * Helper function used to create a new style
         * @returns a new style
         * @see http://doc.babylonjs.com/how_to/gui#styles
         */
        public createStyle(): Style {
            return new Style(this);
        }

        /**
         * Adds a new control to the root container
         * @param control defines the control to add
         * @returns the current texture
         */
        public addControl(control: Control): AdvancedDynamicTexture {
            this._rootContainer.addControl(control);

            return this;
        }

        /**
         * Removes a control from the root container
         * @param control defines the control to remove
         * @returns the current texture
         */        
        public removeControl(control: Control): AdvancedDynamicTexture {
            this._rootContainer.removeControl(control);
            return this;
        }

        /**
         * Release all resources
         */
        public dispose(): void {
            let scene = this.getScene();

            if (!scene) {
                return;
            }

            scene.onBeforeCameraRenderObservable.remove(this._renderObserver);

            if (this._resizeObserver) {
                scene.getEngine().onResizeObservable.remove(this._resizeObserver);
            }

            if (this._pointerMoveObserver) {
                scene.onPrePointerObservable.remove(this._pointerMoveObserver);
            }

            if (this._pointerObserver) {
                scene.onPointerObservable.remove(this._pointerObserver);
            }

            if (this._preKeyboardObserver) {
                scene.onPreKeyboardObservable.remove(this._preKeyboardObserver);
            }

            if (this._canvasPointerOutObserver) {
                scene.getEngine().onCanvasPointerOutObservable.remove(this._canvasPointerOutObserver);
            }

            if (this._layerToDispose) {
                this._layerToDispose.texture = null;
                this._layerToDispose.dispose();
                this._layerToDispose = null;
            }

            this._rootContainer.dispose();

            super.dispose();
        }

        private _onResize(): void {
            let scene = this.getScene();

            if (!scene) {
                return;
            }

            // Check size
            var engine = scene.getEngine();
            var textureSize = this.getSize();
            var renderWidth = engine.getRenderWidth() * this._renderScale;
            var renderHeight = engine.getRenderHeight() * this._renderScale;

            if (this._renderAtIdealSize) {
                if (this._idealWidth) {
                    renderHeight = (renderHeight * this._idealWidth) / renderWidth;
                    renderWidth = this._idealWidth;
                } else if (this._idealHeight) {
                    renderWidth = (renderWidth * this._idealHeight) / renderHeight;
                    renderHeight = this._idealHeight;
                }
            }

            if (textureSize.width !== renderWidth || textureSize.height !== renderHeight) {
                this.scaleTo(renderWidth, renderHeight);

                this.markAsDirty();

                if (this._idealWidth || this._idealHeight) {
                    this._rootContainer._markAllAsDirty();
                }
            }
        }

        /** @hidden */
        public _getGlobalViewport(scene: Scene): Viewport {
            var engine = scene.getEngine();
            return this._fullscreenViewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        }

        /**
         * Get screen coordinates for a vector3
         * @param position defines the position to project
         * @param worldMatrix defines the world matrix to use
         * @returns the projected position
         */
        public getProjectedPosition(position: Vector3, worldMatrix: Matrix): Vector2 {
            var scene = this.getScene();

            if (!scene) {
                return Vector2.Zero();
            }

            var globalViewport = this._getGlobalViewport(scene);
            var projectedPosition = Vector3.Project(position, worldMatrix, scene.getTransformMatrix(), globalViewport);

            projectedPosition.scaleInPlace(this.renderScale);
            
            return new Vector2(projectedPosition.x, projectedPosition.y);
        }

        private _checkUpdate(camera: Camera): void {
            if (this._layerToDispose) {
                if ((camera.layerMask & this._layerToDispose.layerMask) === 0) {
                    return;
                }
            }

            if (this._isFullscreen && this._linkedControls.length) {
                var scene = this.getScene();

                if (!scene) {
                    return;
                }

                var globalViewport = this._getGlobalViewport(scene);

                for (var control of this._linkedControls) {
                    if (!control.isVisible) {
                        continue;
                    }

                    var mesh = control._linkedMesh;

                    if (!mesh || mesh.isDisposed()) {
                        Tools.SetImmediate(() => {
                            control.linkWithMesh(null);
                        });

                        continue;
                    }

                    var position = mesh.getBoundingInfo().boundingSphere.center;
                    var projectedPosition = Vector3.Project(position, mesh.getWorldMatrix(), scene.getTransformMatrix(), globalViewport);

                    if (projectedPosition.z < 0 || projectedPosition.z > 1) {
                        control.notRenderable = true;
                        continue;
                    }
                    control.notRenderable = false;
                    // Account for RenderScale.
                    projectedPosition.scaleInPlace(this.renderScale);
                    control._moveToProjectedPosition(projectedPosition);
                }
            }

            if (!this._isDirty && !this._rootContainer.isDirty) {
                return;
            }
            this._isDirty = false;

            this._render();
            this.update(true, this.premulAlpha);
        }

        private _render(): void {
            var textureSize = this.getSize();
            var renderWidth = textureSize.width;
            var renderHeight = textureSize.height;

            // Clear
            var context = this.getContext();
            context.clearRect(0, 0, renderWidth, renderHeight);
            if (this._background) {
                context.save();
                context.fillStyle = this._background;
                context.fillRect(0, 0, renderWidth, renderHeight);
                context.restore();
            }

            // Render
            context.font = "18px Arial";
            context.strokeStyle = "white";
            var measure = new Measure(0, 0, renderWidth, renderHeight);
            this._rootContainer._draw(measure, context);
        }

        private _doPicking(x: number, y: number, type: number, pointerId: number, buttonIndex: number): void {
            var scene = this.getScene();

            if (!scene) {
                return;
            }

            var engine = scene.getEngine();
            var textureSize = this.getSize();

            if (this._isFullscreen) {
                x = x * (textureSize.width / engine.getRenderWidth());
                y = y * (textureSize.height / engine.getRenderHeight());
            }

            if (this._capturingControl[pointerId]) {
                this._capturingControl[pointerId]._processObservables(type, x, y, pointerId, buttonIndex);
                return;
            }

            if (!this._rootContainer._processPicking(x, y, type, pointerId, buttonIndex)) {

                if (type === BABYLON.PointerEventTypes.POINTERMOVE) {
                    if (this._lastControlOver[pointerId]) {
                        this._lastControlOver[pointerId]._onPointerOut(this._lastControlOver[pointerId]);
                    }

                    delete this._lastControlOver[pointerId];
                }
            }

            this._manageFocus();
        }

        /** @hidden */
        public _cleanControlAfterRemovalFromList(list: {[pointerId:number]:Control}, control:Control) {
            for (var pointerId in list) {
                if (!list.hasOwnProperty(pointerId)) {
                    continue;
                }

                var lastControlOver = list[pointerId];
                if (lastControlOver === control) {
                    delete list[pointerId];
                }
            }
        }

        /** @hidden */
        public _cleanControlAfterRemoval(control: Control) {
            this._cleanControlAfterRemovalFromList(this._lastControlDown, control);
            this._cleanControlAfterRemovalFromList(this._lastControlOver, control);
        }

        /** Attach to all scene events required to support pointer events */
        public attach(): void {
            var scene = this.getScene();
            if (!scene) {
                return;
            }

            this._pointerMoveObserver = scene.onPrePointerObservable.add((pi, state) => {
                if (scene!.isPointerCaptured((<PointerEvent>(pi.event)).pointerId)) {
                    return;
                }

                if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE
                    && pi.type !== BABYLON.PointerEventTypes.POINTERUP
                    && pi.type !== BABYLON.PointerEventTypes.POINTERDOWN) {
                    return;
                }

                if (!scene) {
                    return;
                }

                let camera = scene.cameraToUseForPointers || scene.activeCamera;

                if (!camera) {
                    return;
                }
                let engine = scene.getEngine();
                let viewport = camera.viewport;
                let x = (scene.pointerX / engine.getHardwareScalingLevel() - viewport.x * engine.getRenderWidth()) / viewport.width;
                let y = (scene.pointerY / engine.getHardwareScalingLevel() - viewport.y * engine.getRenderHeight()) / viewport.height;

                this._shouldBlockPointer = false;
                this._doPicking(x, y, pi.type, (pi.event as PointerEvent).pointerId || 0, pi.event.button);

                pi.skipOnPointerObservable = this._shouldBlockPointer;
            });

            this._attachToOnPointerOut(scene);
        }

        /**
         * Connect the texture to a hosting mesh to enable interactions
         * @param mesh defines the mesh to attach to
         * @param supportPointerMove defines a boolean indicating if pointer move events must be catched as well
         */
        public attachToMesh(mesh: AbstractMesh, supportPointerMove = true): void {
            var scene = this.getScene();
            if (!scene) {
                return;
            }
            this._pointerObserver = scene.onPointerObservable.add((pi, state) => {
                if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE
                    && pi.type !== BABYLON.PointerEventTypes.POINTERUP
                    && pi.type !== BABYLON.PointerEventTypes.POINTERDOWN) {
                    return;
                }
                var pointerId = (pi.event as PointerEvent).pointerId || 0;
                if (pi.pickInfo && pi.pickInfo.hit && pi.pickInfo.pickedMesh === mesh) {
                    var uv = pi.pickInfo.getTextureCoordinates();

                    if (uv) {
                        let size = this.getSize();
                        
                        this._doPicking(uv.x * size.width, (1.0 - uv.y) * size.height, pi.type, pointerId, pi.event.button);
                    }
                } else if (pi.type === BABYLON.PointerEventTypes.POINTERUP) {
                    if (this._lastControlDown[pointerId]) {
                        this._lastControlDown[pointerId]._forcePointerUp(pointerId);
                    }
                    delete this._lastControlDown[pointerId];

                    this.focusedControl = null;
                } else if (pi.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                    if (this._lastControlOver[pointerId]) {
                        this._lastControlOver[pointerId]._onPointerOut(this._lastControlOver[pointerId]);
                    }
                    delete this._lastControlOver[pointerId];
                }
            });

            mesh.enablePointerMoveEvents = supportPointerMove;
            this._attachToOnPointerOut(scene);
        }

        /**
         * Move the focus to a specific control
         * @param control defines the control which will receive the focus
         */
        public moveFocusToControl(control: IFocusableControl): void {
            this.focusedControl = control;
            this._lastPickedControl = <any>control;
            this._blockNextFocusCheck = true;
        }

        private _manageFocus(): void {
            if (this._blockNextFocusCheck) {
                this._blockNextFocusCheck = false;
                this._lastPickedControl = <any>this._focusedControl;
                return;
            }

            // Focus management
            if (this._focusedControl) {
                if (this._focusedControl !== (<any>this._lastPickedControl)) {
                    if (this._lastPickedControl.isFocusInvisible) {
                        return;
                    }

                    this.focusedControl = null;
                }
            }
        }

        private _attachToOnPointerOut(scene: Scene): void {
            this._canvasPointerOutObserver = scene.getEngine().onCanvasPointerOutObservable.add((pointerEvent) => {
                if (this._lastControlOver[pointerEvent.pointerId]) {
                    this._lastControlOver[pointerEvent.pointerId]._onPointerOut(this._lastControlOver[pointerEvent.pointerId]);
                }
                delete this._lastControlOver[pointerEvent.pointerId];

                if (this._lastControlDown[pointerEvent.pointerId]) {
                    this._lastControlDown[pointerEvent.pointerId]._forcePointerUp();
                }
                delete this._lastControlDown[pointerEvent.pointerId];
            });
        }

        // Statics
        /**
         * Creates a new AdvancedDynamicTexture in projected mode (ie. attached to a mesh)
         * @param mesh defines the mesh which will receive the texture
         * @param width defines the texture width (1024 by default)
         * @param height defines the texture height (1024 by default)
         * @param supportPointerMove defines a boolean indicating if the texture must capture move events (true by default)
         * @returns a new AdvancedDynamicTexture
         */
        public static CreateForMesh(mesh: AbstractMesh, width = 1024, height = 1024, supportPointerMove = true): AdvancedDynamicTexture {
            var result = new AdvancedDynamicTexture(mesh.name + " AdvancedDynamicTexture", width, height, mesh.getScene(), true, Texture.TRILINEAR_SAMPLINGMODE);

            var material = new BABYLON.StandardMaterial("AdvancedDynamicTextureMaterial", mesh.getScene());
            material.backFaceCulling = false;
            material.diffuseColor = BABYLON.Color3.Black();
            material.specularColor = BABYLON.Color3.Black();
            material.emissiveTexture = result;
            material.opacityTexture = result;

            mesh.material = material;

            result.attachToMesh(mesh, supportPointerMove);

            return result;
        }

        /**
         * Creates a new AdvancedDynamicTexture in fullscreen mode.
         * In this mode the texture will rely on a layer for its rendering.
         * This allows it to be treated like any other layer.
         * As such, if you have a multi camera setup, you can set the layerMask on the GUI as well.
         * LayerMask is set through advancedTexture.layer.layerMask
		 * @param name defines name for the texture
		 * @param foreground defines a boolean indicating if the texture must be rendered in foreground (default is true)
		 * @param scene defines the hsoting scene
		 * @param sampling defines the texture sampling mode (BABYLON.Texture.BILINEAR_SAMPLINGMODE by default)
		 * @returns a new AdvancedDynamicTexture
         */
        public static CreateFullscreenUI(name: string, foreground: boolean = true, scene: Nullable<Scene> = null, sampling = Texture.BILINEAR_SAMPLINGMODE): AdvancedDynamicTexture {
            var result = new AdvancedDynamicTexture(name, 0, 0, scene, false, sampling);

            // Display
            var layer = new BABYLON.Layer(name + "_layer", null, scene, !foreground);
            layer.texture = result;

            result._layerToDispose = layer;
            result._isFullscreen = true;

            // Attach
            result.attach();

            return result;
        }
    }
}