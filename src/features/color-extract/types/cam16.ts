export type Surround = "average" | "dim" | "dark";

export type Parameters = {
    lA: number;
    yB: number;
    surround: Surround;
};

export type BakedParameters = {
    params: Parameters;
    aw: number;
    f: number;
    c: number;
    nc: number;
    d: number;
    fl: number;
    n: number;
    z: number;
    nbb: number;
    ncb: number;
    whitePoint: { x: number; y: number; z: number };
};

export type Cam16UcsJmh = {
    j: number;
    m: number;
    h: number;
};
