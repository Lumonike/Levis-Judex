import { Types } from "mongoose";

import { IProblem } from "./models";

declare global {
    namespace Express {
        interface Request {
            problem?: IProblem;
            user?: { id: Types.ObjectId };
        }
    }
}

export {};
