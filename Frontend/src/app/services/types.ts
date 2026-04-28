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
    layoutType?: 'horizontal' | 'vertical';
    locked?: boolean;
    lockedBy?: string;
}

export interface NodeData {
    id: string;
    type: string;
    x: number;
    y: number;
    label: string;
    policy?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    parentId?: string;
    forms?: Form[];
    responsible?: string;
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
    forms?: Form[];
}

export interface Form {
    id?: string;
    modelingId: string;
    label: string;
    type: string; // text, number, date, select, file, textarea
    defaultValue?: string;
    required: boolean;
    estado?: string;
    options?: string[]; // For select/dropdown fields
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
    type?: string;
    error?: string;
}

// ═══ WORKFLOW ENGINE TYPES ═══

export type ActivityStatus = 'PENDING' | 'IN_PROCESS' | 'IN_REVIEW' | 'FINISHED' | 'CANCELED' | 'SKIPPED';
export type ProcessStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELED';

export interface ActivityInstance {
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    status: ActivityStatus;
    assignedTo?: string;
    formData: Record<string, any>;
    startedAt?: string;
    completedAt?: string;
}

export interface ProcessInstance {
    id?: string;
    designId: string;
    modelingId: string;
    projectId: string;
    designName: string;
    startedBy: string;
    status: ProcessStatus;
    activities: ActivityInstance[];
    variables: Record<string, any>;
    startedAt?: string;
    completedAt?: string;
}

export interface Notification {
    id?: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    referenceId?: string;
    referenceType?: string;
    read: boolean;
    createdAt?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    nodeCount: number;
    edgeCount: number;
}
