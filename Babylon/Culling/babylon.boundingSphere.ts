﻿module BABYLON {
    export class BoundingSphere {
        public center: Vector3;
        public radius: number;
        public centerWorld: Vector3;
        public radiusWorld: number;

        private _tempRadiusVector = Vector3.Zero();

        constructor(public minimum: Vector3, public maximum: Vector3) {
            var distance = BABYLON.Vector3.Distance(minimum, maximum);

            this.center = BABYLON.Vector3.Lerp(minimum, maximum, 0.5);;
            this.radius = distance * 0.5;

            this.centerWorld = BABYLON.Vector3.Zero();
            this._update(BABYLON.Matrix.Identity());
        }

        // Methods
        public _update(world: Matrix): void {
            BABYLON.Vector3.TransformCoordinatesToRef(this.center, world, this.centerWorld);
            BABYLON.Vector3.TransformNormalFromFloatsToRef(1.0, 0, 0, world, this._tempRadiusVector);
            this.radiusWorld = this._tempRadiusVector.length() * this.radius;
        }

        public isInFrustum(frustumPlanes: Plane[]): boolean {
            for (var i = 0; i < 6; i++) {
                if (frustumPlanes[i].dotCoordinate(this.centerWorld) <= -this.radiusWorld)
                    return false;
            }

            return true;
        }

        public intersectsPoint(point: Vector3): boolean {
            var x = this.centerWorld.x - point.x;
            var y = this.centerWorld.y - point.y;
            var z = this.centerWorld.z - point.z;

            var distance = Math.sqrt((x * x) + (y * y) + (z * z));

            if (Math.abs(this.radiusWorld - distance) < Engine.Epsilon)
                return false;

            return true;
        }

        // Statics
        public static Intersects(sphere0: BoundingSphere, sphere1: BoundingSphere): boolean {
            var x = sphere0.centerWorld.x - sphere1.centerWorld.x;
            var y = sphere0.centerWorld.y - sphere1.centerWorld.y;
            var z = sphere0.centerWorld.z - sphere1.centerWorld.z;

            var distance = Math.sqrt((x * x) + (y * y) + (z * z));

            if (sphere0.radiusWorld + sphere1.radiusWorld < distance)
                return false;

            return true;
        }

    }
} 