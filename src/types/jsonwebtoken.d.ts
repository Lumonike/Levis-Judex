import { Types } from "mongoose";

declare module "jsonwebtoken" {
    export interface JwtPayload {
        id: Types.ObjectId;
    }
}

export {};
