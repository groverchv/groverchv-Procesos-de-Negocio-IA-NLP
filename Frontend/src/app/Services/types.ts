export interface Project {
    id?: string;
    nombre: string;
    descripcion: string;
    fechaCreacion?: string;
    ultimaActualizacion?: string;
    designIds?: string[];
}

export interface Design {
    id?: string;
    nombre: string;
    projectId: string;
    modelingId?: string;
    fechaCreacion?: string;
    ultimaActualizacion?: string;
    estado: string;
}



export interface NodeData {
    id: string;
    type: string;
    x: number;
    y: number;
    label: string;
    responsible?: string;
    policy?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    parentId?: string;
    forms?: Form[];
}


export interface EdgeData {
    id: string;
    source: string;
    target: string;
    label?: string;
    color?: string;
    style?: 'solid' | 'dashed';
    strokeWidth?: number;
    opacity?: number;
    waypoints?: {x: number, y: number}[];
}



export interface Form {
    id?: string;
    modelingId: string;
    label: string;
    type: string;
    defaultValue?: string;
    required: boolean;
    estado?: string;
}

export interface Modeling {
    id?: string;
    nodes: NodeData[];
    edges: EdgeData[];
    version?: string;
    estado?: string;
    senderId?: string;
    timestamp?: number;
    isDragPulse?: boolean;
}
