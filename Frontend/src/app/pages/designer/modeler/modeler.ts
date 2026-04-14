import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { DesignService } from '../../../Services/design.service';
import { ModelingSocketService } from '../../../WebSockets/modeling-socket.service';
import { NodeData, EdgeData, Modeling, Form } from '../../../Services/types';
import { IaService, DiagramCommand } from '../../../Services/IA/ia.service';

@Component({
  selector: 'app-modeler',
  standalone: true,
  imports: [
    CommonModule, NzLayoutModule, NzButtonModule, NzIconModule, NzTypographyModule,
    NzSpaceModule, NzCardModule, NzInputModule, NzTagModule, NzDividerModule,
    NzTooltipModule, FormsModule, RouterLink, NzInputNumberModule, NzSelectModule, NzCheckboxModule
  ],
  templateUrl: './modeler.html',
  styleUrls: ['./modeler.css']
})
export class ModelerComponent implements OnInit, OnDestroy {
  @ViewChild('svgElement', { static: false }) svgElement!: ElementRef;

  // ---- Core State ----
  designId: string | null = null;
  modelingId: string | null = null;
  nodes: NodeData[] = [];
  edges: EdgeData[] = [];

  // ---- Selection State ----
  selectedNode: NodeData | null = null;
  selectedEdge: EdgeData | null = null;

  // ---- Drag State ----
  isDragging = false;
  draggedNode: NodeData | null = null;
  draggedChildren: NodeData[] = [];
  offset = { x: 0, y: 0 };
  dragWaypoint: { edgeId: string, index: number } | null = null;

  // ---- Connection State ----
  isConnectingMode = false;
  connectingSource: NodeData | null = null;

  // ---- Edge Editing ----
  edgeColor: string = '#64748b';

  // ---- History (Undo/Redo) ----
  private history: string[] = [];
  private historyIndex = -1;

  // ---- Collaboration ----
  connectedUsers = 0;
  otherCursors: any = {};
  private lastReceivedTimestamp = 0;

  // ---- AI Assistant ----
  showAiPanel = false;
  aiInput = '';
  aiLoading = false;
  aiLastMessage = '';
  isListening = false;
  private recognition: any = null;

  private socketSubscription: Subscription | null = null;
  private presenceSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private designService: DesignService,
    private socketService: ModelingSocketService,
    private iaService: IaService,
    private message: NzMessageService
  ) {
    this.designId = this.route.snapshot.paramMap.get('designId');
  }

  // ===== LIFECYCLE =====

  ngOnInit(): void {
    if (this.designId) {
      this.loadInitialData();
      this.connectToSocket();
      this.setupVoiceRecognition();
    }
  }

  ngOnDestroy(): void {
    this.socketSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.socketService.disconnect();
  }

  // ===== DATA LOADING =====

  loadInitialData() {
    this.designService.getModelingByDesignId(this.designId!).subscribe({
      next: (modeling: Modeling) => {
        this.modelingId = modeling.id || null;
        this.nodes = modeling.nodes || [];
        this.edges = modeling.edges || [];
        this.saveHistory();
      },
      error: (err) => console.error('Error loading initial modeling data', err)
    });
  }

  connectToSocket() {
    this.lastReceivedTimestamp = 0;
    this.socketSubscription = this.socketService.connect(this.designId!).subscribe({
      next: (m: Modeling) => {
        if (m.senderId === this.socketService.currentUserId) return;
        if (m.timestamp && m.timestamp < this.lastReceivedTimestamp) return;
        this.lastReceivedTimestamp = m.timestamp || 0;
        
        const remoteNodes = m.nodes || [];
        
        // ---- HIGH SPEED PULSE PATH ----
        if (m.isDragPulse) {
          remoteNodes.forEach(rn => {
             // Skip if I am dragging it
             if (this.isDragging && this.draggedNode?.id === rn.id) return;
             
             // Direct DOM Manipulation for zero latency
             const el = document.getElementById('node-' + rn.id);
             if (el) {
                el.setAttribute('transform', `translate(${rn.x},${rn.y})`);
             }
             
             // Also update local object values WITHOUT triggering full change detection
             const ln = this.nodes.find(n => n.id === rn.id);
             if (ln) { ln.x = rn.x; ln.y = rn.y; }
          });
          return; // Skip heavy Angular logic for pulses
        }

        // ---- STANDARD SYNC PATH (Final drops, additions, labels) ----
        const remoteEdges = m.edges || [];
        remoteNodes.forEach(rn => {
          if (this.isDragging && this.draggedNode?.id === rn.id) return;
          const index = this.nodes.findIndex(n => n.id === rn.id);
          if (index !== -1) {
            this.nodes[index] = { ...this.nodes[index], ...rn }; 
          } else {
            this.nodes.push(rn);
          }
        });
        this.nodes = this.nodes.filter(ln => {
           if (this.isDragging && this.draggedNode?.id === ln.id) return true;
           return remoteNodes.some(rn => rn.id === ln.id);
        });
        remoteEdges.forEach(re => {
          if (this.dragWaypoint && this.dragWaypoint.edgeId === re.id) return;
          const index = this.edges.findIndex(e => e.id === re.id);
          if (index !== -1) { this.edges[index] = { ...this.edges[index], ...re }; } 
          else { this.edges.push(re); }
        });
        this.edges = this.edges.filter(le => {
          if (this.dragWaypoint && this.dragWaypoint.edgeId === le.id) return true;
          return remoteEdges.some(re => re.id === le.id);
        });
      },
      error: (err) => console.error('Socket error', err)
    });

    this.presenceSubscription = this.socketService.connectedCount$.subscribe(count => {
      this.connectedUsers = count;
    });

    this.socketService.cursors$.subscribe(cursors => {
      this.otherCursors = cursors;
    });
  }

  // ===== HISTORY (UNDO/REDO) =====

  saveHistory() {
    const state = JSON.stringify({ nodes: this.nodes, edges: this.edges });
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(state);
    this.historyIndex++;
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.nodes = state.nodes;
      this.edges = state.edges;
      this.broadcastUpdate(false);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = JSON.parse(this.history[this.historyIndex]);
      this.nodes = state.nodes;
      this.edges = state.edges;
      this.broadcastUpdate(false);
    }
  }

  // ===== KEYBOARD SHORTCUTS =====

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.undo();
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      this.redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        if (this.selectedNode) this.deleteNode();
        else if (this.selectedEdge) this.deleteEdge();
      }
    } else if (event.key === 'Escape') {
      this.isConnectingMode = false;
      this.showAiPanel = false;
    }
  }

  // ===== BROADCASTING =====

  broadcastUpdate(shouldSaveHistory = true, isDragPulse = false) {
    if (this.designId) {
      // Game-Mode Delta Packets: if dragging, only send the moved node
      let modeling: Modeling;
      
      if (isDragPulse && this.draggedNode) {
        modeling = {
          nodes: [this.draggedNode],
          edges: [],
          isDragPulse: true,
          senderId: this.socketService.currentUserId,
          timestamp: Date.now()
        };
      } else if (isDragPulse && this.dragWaypoint) {
        const edge = this.edges.find(e => e.id === this.dragWaypoint!.edgeId);
        modeling = {
          nodes: [],
          edges: edge ? [edge] : [],
          isDragPulse: true,
          senderId: this.socketService.currentUserId,
          timestamp: Date.now()
        };
      } else {
        modeling = {
          id: this.modelingId || undefined,
          nodes: this.nodes,
          edges: this.edges,
          isDragPulse: false,
          senderId: this.socketService.currentUserId,
          timestamp: Date.now()
        };
      }
      
      this.socketService.sendUpdate(this.designId, modeling, isDragPulse);
      if (shouldSaveHistory) {
        this.saveHistory();
      }
    }
  }

  // Live broadcast (throttled for fluidity)
  private lastBroadcastTime = 0;
  private throttledBroadcast() {
    const now = Date.now();
    if (now - this.lastBroadcastTime > 15) { // 66 FPS for sub-millimeter precision
      this.broadcastUpdate(false, true); 
      this.lastBroadcastTime = now;
    }
  }

  // Cursor broadcast
  private lastCursorTime = 0;
  private sendThrottledCursor(x: number, y: number) {
    const now = Date.now();
    if (now - this.lastCursorTime > 30) { // ~30fps for cursors is enough
      this.socketService.sendCursor(this.designId!, x, y);
      this.lastCursorTime = now;
    }
  }

  // ===== SELECTION =====

  selectNode(node: NodeData, event: MouseEvent) {
    event.stopPropagation();
    this.selectedEdge = null;

    if (this.isConnectingMode) {
      if (!this.connectingSource) {
        this.connectingSource = node;
      } else if (this.connectingSource.id !== node.id) {
        this.createEdge(this.connectingSource.id, node.id);
        this.connectingSource = null;
        this.isConnectingMode = false;
      }
      return;
    }

    this.selectedNode = node;
  }

  selectEdge(edge: EdgeData, event: MouseEvent) {
    event.stopPropagation();
    this.selectedNode = null;
    this.selectedEdge = edge;
    this.edgeColor = edge.color || '#64748b';
  }

  deselectAll() {
    this.selectedNode = null;
    this.selectedEdge = null;
    if (!this.isConnectingMode) {
      this.connectingSource = null;
    }
  }

  // ===== EDGE EDITING =====

  updateEdgeColor(color: string) {
    if (this.selectedEdge) {
      this.selectedEdge.color = color;
      this.broadcastUpdate();
    }
  }

  toggleConnectionMode() {
    this.isConnectingMode = !this.isConnectingMode;
    this.connectingSource = null;
    this.selectedNode = null;
    this.selectedEdge = null;
  }

  createEdge(sourceId: string, targetId: string) {
    const newEdge: EdgeData = {
      id: `edge_${Date.now()}`,
      source: sourceId,
      target: targetId,
      style: 'solid',
      color: '#64748b',
      strokeWidth: 2,
      opacity: 100,
      waypoints: []
    };
    this.edges.push(newEdge);
    this.broadcastUpdate();
  }

  deleteEdge() {
    if (this.selectedEdge) {
      this.edges = this.edges.filter(e => e.id !== this.selectedEdge?.id);
      this.selectedEdge = null;
      this.broadcastUpdate();
    }
  }

  // ===== WAYPOINTS =====

  addWaypoint(event: MouseEvent, edge: EdgeData) {
    event.stopPropagation();
    if (!edge.waypoints) edge.waypoints = [];
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    edge.waypoints.push({ x: svgPt.x, y: svgPt.y });
    this.broadcastUpdate();
  }

  startWaypointDrag(event: MouseEvent, edgeId: string, index: number) {
    event.stopPropagation();
    this.dragWaypoint = { edgeId, index };
  }

  // Allow creating a waypoint by dragging the line
  startLineDrag(event: MouseEvent, edge: EdgeData) {
    if (this.isConnectingMode) return;
    this.selectEdge(edge, event);
    
    // Create a new waypoint at the current mouse position
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    
    if (!edge.waypoints) edge.waypoints = [];
    edge.waypoints.push({ x: svgPt.x, y: svgPt.y });
    this.dragWaypoint = { edgeId: edge.id, index: edge.waypoints.length - 1 };
    
    event.stopPropagation();
  }

  removeWaypoint(event: MouseEvent, edge: EdgeData, index: number) {
    event.stopPropagation();
    if (edge.waypoints) {
      edge.waypoints.splice(index, 1);
      this.broadcastUpdate();
    }
  }

  // ===== DRAG & DROP =====

  onMouseDown(node: NodeData, event: MouseEvent) {
    if (this.isConnectingMode) {
      this.selectNode(node, event);
      return;
    }

    this.isDragging = true;
    this.draggedNode = node;
    this.selectedNode = node;
    this.selectedEdge = null;

    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    this.offset = { x: svgPt.x - node.x, y: svgPt.y - node.y };

    if (node.type === 'swimlane') {
      this.draggedChildren = this.nodes.filter(n =>
        n.type !== 'swimlane' &&
        n.y >= node.y &&
        n.y <= (node.y + (node.height || 200))
      );
    } else {
      this.draggedChildren = [];
    }
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.svgElement) return;
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // Send cursor position to others (throttled)
    this.sendThrottledCursor(svgPt.x, svgPt.y);

    // Waypoint drag
    if (this.dragWaypoint) {
      const edge = this.edges.find(e => e.id === this.dragWaypoint!.edgeId);
      if (edge && edge.waypoints) {
        edge.waypoints[this.dragWaypoint.index] = { x: svgPt.x, y: svgPt.y };
        this.throttledBroadcast();
      }
      return;
    }

    // Node drag
    if (this.isDragging && this.draggedNode) {
      const newX = svgPt.x - this.offset.x;
      const newY = svgPt.y - this.offset.y;

      if (this.draggedNode.type === 'swimlane') {
        const deltaY = newY - this.draggedNode.y;
        this.draggedNode.x = 0;
        this.draggedNode.y = newY;
        this.draggedChildren.forEach(child => { child.y += deltaY; });
        this.syncLanesLayout(true);
      } else {
        this.draggedNode.x = Math.max(0, newX);
        this.draggedNode.y = Math.max(0, newY);
        this.checkAndExpandLanes();
      }
      this.throttledBroadcast();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.dragWaypoint || this.isDragging) {
      if (this.draggedNode?.type === 'swimlane') {
        this.syncLanesLayout(false);
      }
      // Final persistence save and history save
      this.broadcastUpdate(true, false);
      
      this.isDragging = false;
      this.draggedNode = null;
      this.dragWaypoint = null;
      this.draggedChildren = [];
    }
  }

  // ===== LANE LAYOUT =====

  syncLanesLayout(isDragging = false) {
    const lanes = this.nodes.filter(n => n.type === 'swimlane').sort((a, b) => a.y - b.y);
    let currentY = 0;
    lanes.forEach(lane => {
      const oldY = lane.y;
      lane.x = 0;
      if (!isDragging || (this.draggedNode && lane.id !== this.draggedNode.id)) {
        lane.y = currentY;
      }
      const deltaY = lane.y - oldY;
      if (!isDragging && deltaY !== 0) {
        this.nodes.filter(n => n.type !== 'swimlane' && n.y >= oldY && n.y <= (oldY + (lane.height || 200)))
          .forEach(child => child.y += deltaY);
      }
      currentY += (lane.height || 200);
    });
  }

  checkAndExpandLanes() {
    const lanes = this.nodes.filter(n => n.type === 'swimlane');
    const otherNodes = this.nodes.filter(n => n.type !== 'swimlane');
    let maxRight = 1200;
    otherNodes.forEach(node => {
      const right = node.x + (node.width || 160) + 100;
      if (right > maxRight) maxRight = right;
    });
    lanes.forEach(lane => { lane.width = maxRight; });
  }

  // ===== NODE CRUD =====

  addNode(type: string) {
    let x = 100, y = 200;
    if (type === 'swimlane') {
      const lanes = this.nodes.filter(n => n.type === 'swimlane');
      y = lanes.length > 0 ? Math.max(...lanes.map(l => l.y + (l.height || 200))) : 0;
      x = 0;
    } else {
      const firstLane = this.nodes.find(n => n.type === 'swimlane');
      if (firstLane) { y = firstLane.y + 50; x = firstLane.x + 100; }
    }

    const dims: Record<string, [number, number]> = {
      swimlane: [1200, 200], decision: [120, 100], parallel: [120, 100],
      start: [40, 40], end: [40, 40]
    };
    const [defaultW, defaultH] = dims[type] || [160, 80];

    const newNode: NodeData = {
      id: `${type}_${Date.now()}`,
      type, x, y,
      label: type === 'decision' ? '¿Condición?' : `Nuevo ${type.toUpperCase()}`,
      width: defaultW, height: defaultH, fontSize: 12
    };

    this.nodes.push(newNode);
    this.selectedNode = newNode;
    this.checkAndExpandLanes();
    this.broadcastUpdate();
  }

  deleteNode() {
    if (this.selectedNode) {
      this.edges = this.edges.filter(e => e.source !== this.selectedNode?.id && e.target !== this.selectedNode?.id);
      this.nodes = this.nodes.filter(n => n.id !== this.selectedNode?.id);
      this.selectedNode = null;
      this.broadcastUpdate();
    }
  }

  // ===== FORM MANAGEMENT =====

  getFormsForSelectedNode(): Form[] {
    if (this.selectedNode) {
      if (!this.selectedNode.forms) this.selectedNode.forms = [];
      return this.selectedNode.forms;
    }
    return [];
  }

  addFormField() {
    if (this.selectedNode) {
      if (!this.selectedNode.forms) this.selectedNode.forms = [];
      this.selectedNode.forms.push({
        modelingId: this.modelingId || '',
        label: 'Nuevo Campo',
        type: 'text',
        required: false
      });
      this.broadcastUpdate();
    }
  }

  removeFormField(index: number) {
    if (this.selectedNode && this.selectedNode.forms) {
      this.selectedNode.forms.splice(index, 1);
      this.broadcastUpdate();
    }
  }

  // ===== EDGE ROUTING =====

  getNodeById(id: string): NodeData | undefined {
    return this.nodes.find(n => n.id === id);
  }

  private getPort(node: NodeData, targetNode: NodeData, edgeId: string, isSource: boolean): { x: number; y: number } {
    const w = node.width || 120;
    const h = node.height || 80;
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;

    const tcx = targetNode.x + (targetNode.width || 120) / 2;
    const tcy = targetNode.y + (targetNode.height || 80) / 2;

    const dx = tcx - cx;
    const dy = tcy - cy;

    // Determine side
    let side: 'top' | 'bottom' | 'left' | 'right';
    if (Math.abs(dx) > Math.abs(dy)) {
      side = dx > 0 ? 'right' : 'left';
    } else {
      side = dy > 0 ? 'bottom' : 'top';
    }

    // Get all edges on this side of the node
    const sideEdges = this.edges.filter(e => {
      const s = this.getNodeById(e.source);
      const t = this.getNodeById(e.target);
      if (!s || !t) return false;
      
      // Calculate side for this edge
      const scx = s.x + (s.width || 120) / 2;
      const scy = s.y + (s.height || 80) / 2;
      const tcx = t.x + (t.width || 120) / 2;
      const tcy = t.y + (t.height || 80) / 2;
      
      if (e.source === node.id) {
        const dxi = tcx - scx;
        const dyi = tcy - scy;
        const s_side = Math.abs(dxi) > Math.abs(dyi) ? (dxi > 0 ? 'right' : 'left') : (dyi > 0 ? 'bottom' : 'top');
        return s_side === side;
      }
      if (e.target === node.id) {
        const dxi = scx - tcx;
        const dyi = scy - tcy;
        const t_side = Math.abs(dxi) > Math.abs(dyi) ? (dxi > 0 ? 'right' : 'left') : (dyi > 0 ? 'bottom' : 'top');
        return t_side === side;
      }
      return false;
    }).sort((a, b) => a.id.localeCompare(b.id));

    const total = sideEdges.length;
    const index = sideEdges.findIndex(e => e.id === edgeId);
    
    // Distribute port along the side (spacing)
    const offset = (index + 1) * (1 / (total + 1));

    switch (side) {
      case 'left': return { x: node.x, y: node.y + h * offset };
      case 'right': return { x: node.x + w, y: node.y + h * offset };
      case 'top': return { x: node.x + w * offset, y: node.y };
      case 'bottom': return { x: node.x + w * offset, y: node.y + h };
    }
  }

  getConnectorPath(edge: EdgeData): string {
    const source = this.getNodeById(edge.source);
    const target = this.getNodeById(edge.target);
    if (!source || !target) return '';

    const out = this.getPort(source, target, edge.id, true);
    const inp = this.getPort(target, source, edge.id, false);

    const points: {x: number, y: number}[] = [out];
    if (edge.waypoints && edge.waypoints.length > 0) {
      points.push(...edge.waypoints);
    } else {
      // Smart Orthogonal routing: avoid midpoints that overlap with source/target bounds
      const dx = inp.x - out.x;
      const dy = inp.y - out.y;
      
      const sourceMidX = out.x + dx/2;
      const sourceMidY = out.y + dy/2;

      // Decide orientation based on major displacement
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal major
        points.push({ x: sourceMidX, y: out.y });
        points.push({ x: sourceMidX, y: inp.y });
      } else {
        // Vertical major
        points.push({ x: out.x, y: sourceMidY });
        points.push({ x: inp.x, y: sourceMidY });
      }
    }
    points.push(inp);

    // Build path with rounded corners (Bézier)
    let path = `M ${points[0].x} ${points[0].y}`;
    const radius = 10;
    
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i-1];
      const p2 = points[i];
      const p3 = points[i+1];

      // Vector from p2 to p1 and p3
      const d1 = { x: p1.x - p2.x, y: p1.y - p2.y };
      const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const len1 = Math.sqrt(d1.x*d1.x + d1.y*d1.y);
      const len2 = Math.sqrt(d2.x*d2.x + d2.y*d2.y);
      const r = Math.min(radius, len1/2, len2/2);

      const start = { x: p2.x + (d1.x/len1)*r, y: p2.y + (d1.y/len1)*r };
      const end = { x: p2.x + (d2.x/len2)*r, y: p2.y + (d2.y/len2)*r };

      path += ` L ${start.x} ${start.y} Q ${p2.x} ${p2.y} ${end.x} ${end.y}`;
    }
    
    path += ` L ${points[points.length-1].x} ${points[points.length-1].y}`;
    return path;
  }

  getLabelX(edge: EdgeData): number {
    const src = this.getNodeById(edge.source);
    const tgt = this.getNodeById(edge.target);
    if (!src || !tgt) return 0;
    const out = this.getPort(src, tgt, edge.id, true);
    const inp = this.getPort(tgt, src, edge.id, false);
    if (edge.waypoints && edge.waypoints.length > 0) {
      const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
      return mid.x - 40;
    }
    return (out.x + inp.x) / 2 - 40;
  }

  getLabelY(edge: EdgeData): number {
    const src = this.getNodeById(edge.source);
    const tgt = this.getNodeById(edge.target);
    if (!src || !tgt) return 0;
    const out = this.getPort(src, tgt, edge.id, true);
    const inp = this.getPort(tgt, src, edge.id, false);
    if (edge.waypoints && edge.waypoints.length > 0) {
      const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
      return mid.y - 15;
    }
    return (out.y + inp.y) / 2 - 15;
  }

  // ===== AI ASSISTANT =====

  toggleAiPanel() {
    this.showAiPanel = !this.showAiPanel;
    if (this.showAiPanel) {
      setTimeout(() => {
        const el = document.getElementById('ai-input') as HTMLInputElement;
        if (el) el.focus();
      }, 100);
    }
  }

  sendAiCommand() {
    if (!this.aiInput.trim() || this.aiLoading) return;
    const cmd = this.aiInput.trim();
    this.aiInput = '';
    this.aiLoading = true;
    this.aiLastMessage = `⏳ Procesando: "${cmd}"...`;

    this.iaService.processCommand(cmd, this.nodes, this.edges).subscribe({
      next: (response) => {
        this.aiLoading = false;
        this.aiLastMessage = '✅ ' + (response.explanation || 'Comando ejecutado exitosamente');
        if (response.umlValidation) {
          this.message.warning(`⚠️ UML: ${response.umlValidation}`);
        }
        this.executeAiCommands(response.commands);
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiLastMessage = '❌ Error al procesar el comando. Intenta de nuevo.';
        console.error('[AI] Error:', err);
      }
    });
  }

  executeAiCommands(commands: DiagramCommand[]) {
    for (const cmd of commands) {
      switch (cmd.action) {

        // ═══ NODE MANAGEMENT ═══
        case 'add_node': {
          const dims: Record<string, [number, number]> = {
            swimlane: [1200, 200], decision: [120, 100], parallel: [120, 100],
            start: [40, 40], end: [40, 40], datastore: [80, 60]
          };
          const type = cmd.nodeType || 'activity';

          // UML: prevent duplicate start nodes
          if (type === 'start' && this.nodes.some(n => n.type === 'start')) {
            this.message.warning('⚠️ UML: Ya existe un nodo de inicio. Solo se permite uno.');
            break;
          }

          const [w, h] = dims[type] || [160, 80];

          // Smart positioning: place inside target lane if one exists
          let posY = cmd.y ?? 200;
          let posX = cmd.x ?? 200;
          if (type === 'swimlane') {
            const lanes = this.nodes.filter(n => n.type === 'swimlane');
            posY = lanes.length > 0 ? Math.max(...lanes.map(l => l.y + (l.height || 200))) : 0;
            posX = 0;
          } else if (!cmd.y) {
            // Auto-position inside the first lane
            const firstLane = this.nodes.find(n => n.type === 'swimlane');
            if (firstLane) {
              posY = firstLane.y + 50;
              if (!cmd.x) posX = firstLane.x + 160;
            }
          }

          this.nodes.push({
            id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            type, x: posX, y: posY,
            label: cmd.label || `Nuevo ${type}`,
            width: cmd.width || w, height: cmd.height || h,
            fontSize: cmd.fontSize || 12,
            responsible: cmd.responsible
          });
          break;
        }

        case 'delete_node': {
          const toDelete = cmd.nodeId || this.nodes.find(n => n.label === cmd.label)?.id;
          if (toDelete) {
            this.nodes = this.nodes.filter(n => n.id !== toDelete);
            this.edges = this.edges.filter(e => e.source !== toDelete && e.target !== toDelete);
          }
          break;
        }

        case 'update_node': {
          const n = cmd.nodeId
            ? this.nodes.find(n => n.id === cmd.nodeId)
            : this.nodes.find(n => n.label === cmd.label);
          if (n) {
            if (cmd.newLabel !== undefined) n.label = cmd.newLabel;
            else if (cmd.label !== undefined && !cmd.nodeId) { /* label used for lookup, skip */ }
            else if (cmd.label !== undefined) n.label = cmd.label;
            if (cmd.x !== undefined) n.x = cmd.x;
            if (cmd.y !== undefined) n.y = cmd.y;
            if (cmd.width !== undefined) n.width = cmd.width;
            if (cmd.height !== undefined) n.height = cmd.height;
            if (cmd.fontSize !== undefined) n.fontSize = cmd.fontSize;
            if (cmd.responsible !== undefined) n.responsible = cmd.responsible;
            if (cmd.policy !== undefined) n.policy = cmd.policy;
          }
          break;
        }

        // ═══ EDGE MANAGEMENT ═══
        case 'add_edge': {
          const srcNode = this.nodes.find(n => n.id === cmd.sourceId || n.label === cmd.sourceId);
          const tgtNode = this.nodes.find(n => n.id === cmd.targetId || n.label === cmd.targetId);
          if (srcNode && tgtNode) {
            this.edges.push({
              id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              source: srcNode.id, target: tgtNode.id,
              label: cmd.edgeLabel || cmd.label,
              style: (cmd.edgeStyle as any) || 'solid',
              color: cmd.edgeColor || '#455a64',
              strokeWidth: 2, opacity: 100, waypoints: []
            });
          }
          break;
        }

        case 'delete_edge': {
          if (cmd.edgeId) {
            this.edges = this.edges.filter(e => e.id !== cmd.edgeId);
          } else if (cmd.sourceId && cmd.targetId) {
            const src = this.nodes.find(n => n.id === cmd.sourceId || n.label === cmd.sourceId);
            const tgt = this.nodes.find(n => n.id === cmd.targetId || n.label === cmd.targetId);
            if (src && tgt) {
              this.edges = this.edges.filter(e => !(e.source === src.id && e.target === tgt.id));
            }
          }
          break;
        }

        case 'update_edge': {
          let e: EdgeData | undefined;
          if (cmd.edgeId) {
            e = this.edges.find(e => e.id === cmd.edgeId);
          } else if (cmd.sourceId && cmd.targetId) {
            const src = this.nodes.find(n => n.id === cmd.sourceId || n.label === cmd.sourceId);
            const tgt = this.nodes.find(n => n.id === cmd.targetId || n.label === cmd.targetId);
            if (src && tgt) e = this.edges.find(e => e.source === src.id && e.target === tgt.id);
          }
          if (e) {
            if (cmd.edgeLabel !== undefined) e.label = cmd.edgeLabel;
            if (cmd.label !== undefined) e.label = cmd.label;
            if (cmd.edgeStyle !== undefined) e.style = cmd.edgeStyle as any;
            if (cmd.edgeColor !== undefined) e.color = cmd.edgeColor;
          }
          break;
        }

        // ═══ SWIMLANE OPERATIONS ═══
        case 'move_node_to_lane': {
          const node = cmd.nodeId
            ? this.nodes.find(n => n.id === cmd.nodeId)
            : this.nodes.find(n => n.label === cmd.label);
          const targetLane = this.nodes.find(n =>
            n.type === 'swimlane' && n.label === cmd.targetLaneName
          );
          if (node && targetLane) {
            // Position node within the target lane's vertical bounds
            node.y = targetLane.y + ((targetLane.height || 200) / 2) - ((node.height || 80) / 2);
            // Keep X or adjust if outside lane bounds
            if (node.x < targetLane.x + 40) node.x = targetLane.x + 160;
          } else if (!targetLane && cmd.targetLaneName) {
            this.message.warning(`⚠️ Carril "${cmd.targetLaneName}" no encontrado.`);
          }
          break;
        }

        case 'reorder_lanes': {
          if (cmd.laneOrder && cmd.laneOrder.length > 0) {
            let currentY = 0;
            for (const laneName of cmd.laneOrder) {
              const lane = this.nodes.find(n => n.type === 'swimlane' && n.label === laneName);
              if (lane) {
                const oldY = lane.y;
                const laneH = lane.height || 200;
                const deltaY = currentY - oldY;
                lane.y = currentY;
                lane.x = 0;
                // Move all nodes inside this lane
                this.nodes.filter(n =>
                  n.type !== 'swimlane' && n.y >= oldY && n.y < oldY + laneH
                ).forEach(n => n.y += deltaY);
                currentY += laneH;
              }
            }
          }
          break;
        }

        // ═══ RECONNECT & REROUTE ═══
        case 'reconnect_edge': {
          let edge: EdgeData | undefined;
          if (cmd.edgeId) {
            edge = this.edges.find(e => e.id === cmd.edgeId);
          } else if (cmd.sourceId && cmd.targetId) {
            const src = this.nodes.find(n => n.id === cmd.sourceId || n.label === cmd.sourceId);
            const tgt = this.nodes.find(n => n.id === cmd.targetId || n.label === cmd.targetId);
            if (src && tgt) edge = this.edges.find(e => e.source === src.id && e.target === tgt.id);
          }
          if (edge) {
            if (cmd.newSourceId) {
              const newSrc = this.nodes.find(n => n.id === cmd.newSourceId || n.label === cmd.newSourceId);
              if (newSrc) edge.source = newSrc.id;
            }
            if (cmd.newTargetId) {
              const newTgt = this.nodes.find(n => n.id === cmd.newTargetId || n.label === cmd.newTargetId);
              if (newTgt) edge.target = newTgt.id;
            }
            edge.waypoints = []; // Clear waypoints after reconnection
          }
          break;
        }

        // ═══ BATCH STYLE ═══
        case 'batch_update_style': {
          if (cmd.targetType) {
            this.nodes.filter(n => n.type === cmd.targetType).forEach(n => {
              if (cmd.fontSize !== undefined) n.fontSize = cmd.fontSize;
              if (cmd.width !== undefined) n.width = cmd.width;
              if (cmd.height !== undefined) n.height = cmd.height;
            });
          }
          break;
        }

        // ═══ AUTO LAYOUT ═══
        case 'auto_layout': {
          // Simple left-to-right layout within each lane
          const lanes = this.nodes.filter(n => n.type === 'swimlane').sort((a, b) => a.y - b.y);
          const nonLanes = this.nodes.filter(n => n.type !== 'swimlane');
          if (lanes.length === 0) {
            // No lanes: simple horizontal layout
            let x = 100;
            nonLanes.forEach(n => {
              n.x = x;
              n.y = 200;
              x += (n.width || 160) + 80;
            });
          } else {
            // Group nodes by lane, then layout within each
            lanes.forEach(lane => {
              const laneNodes = nonLanes.filter(n =>
                n.y >= lane.y && n.y < lane.y + (lane.height || 200)
              );
              let x = 160;
              laneNodes.forEach(n => {
                n.x = x;
                n.y = lane.y + ((lane.height || 200) / 2) - ((n.height || 80) / 2);
                x += (n.width || 160) + 80;
              });
            });
          }
          break;
        }

        // ═══ CLEAR ALL ═══
        case 'clear_all':
          this.nodes = [];
          this.edges = [];
          break;
      }
    }
    this.checkAndExpandLanes();
    this.broadcastUpdate();
    this.message.success(`IA: ${this.aiLastMessage}`);
  }

  // ===== VOICE =====

  setupVoiceRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.aiInput = transcript;
        this.isListening = false;
        this.sendAiCommand();
      };
      this.recognition.onend = () => { this.isListening = false; };
      this.recognition.onerror = () => { this.isListening = false; };
    }
  }

  toggleVoice() {
    if (!this.recognition) {
      this.message.warning('Tu navegador no soporta comandos de voz');
      return;
    }
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    } else {
      this.showAiPanel = true;
      this.isListening = true;
      this.aiLastMessage = '🎤 Escuchando... Habla ahora';
      this.recognition.start();
    }
  }
}
