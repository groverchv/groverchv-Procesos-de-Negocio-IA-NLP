import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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

import { DesignService } from '../../../services/design.service';
import { ModelingSocketService } from '../../../web-sockets/modeling-socket.service';
import { NodeData, EdgeData, Modeling, Form, ValidationResult } from '../../../services/types';
import { IaService, DiagramCommand } from '../../../services/ia/ia.service';
import { ProcessInstanceService } from '../../../services/process-instance.service';
import { GeminiLiveService } from '../../../services/ia/groq-live.service';
import { SettingsModalComponent } from '../../../components/settings-modal/settings-modal';

@Component({
  selector: 'app-modeler',
  standalone: true,
  imports: [
    CommonModule, NzLayoutModule, NzButtonModule, NzIconModule, NzTypographyModule,
    NzSpaceModule, NzCardModule, NzInputModule, NzTagModule, NzDividerModule,
    NzTooltipModule, FormsModule, NzInputNumberModule, NzSelectModule, NzCheckboxModule,
    SettingsModalComponent
  ],
  templateUrl: './modeler.html',
  styleUrls: ['./modeler.css']
})
export class ModelerComponent implements OnInit, OnDestroy {
  @ViewChild('svgElement', { static: false }) svgElement!: ElementRef;

  // ---- Core State ----
  designId: string | null = null;
  projectId: string | null = null;
  modelingId: string | null = null;
  layoutType: string = 'vertical';
  nodes: NodeData[] = [];
  edges: EdgeData[] = [];

  // ---- Selection State ----
  selectedNode: NodeData | null = null;
  selectedEdge: EdgeData | null = null;

  // ---- Drag State ----
  isDragging = false;
  draggedNode: NodeData | null = null;
  draggedChildren: NodeData[] = [];
  draggedWaypoints: { x: number, y: number }[] = [];
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

  // ---- Validation ----
  showValidation = false;
  validationResult: ValidationResult | null = null;

  // Buffers para edición de propiedades de calles (evitan saltos mientras se teclea)
  tempLaneWidth: number = 300;
  tempLaneHeight: number = 520;

  // ---- Voice Assistant (Gemini Live) ----
  showAssistantPanel = false;
  assistantInput = '';
  assistantThinking = false;
  assistantListening = false;
  assistantSpeaking = false;
  assistantConnected = false;
  assistantHistory: { role: string; content: string }[] = [];
  assistantTranscript = '';

  // Settings
  showSettings = false;
  errorNodeIds: string[] = [];
  continuousListening = false;
  get isReadOnly(): boolean {
    return this.router.url.includes('staff');
  }
  isExecuting = false;
  currentExecutionNodeId: string | null = null;
  executionHistory: string[] = [];
  processInstance: any = null;
  formChecks: Record<string, boolean> = {};

  // ---- Multi-Selection (Plan §3: Macro-Operaciones) ----
  selectedNodes: NodeData[] = [];
  isSelectionBoxActive = false;
  selectionBox = { x: 0, y: 0, w: 0, h: 0 };
  private selectionStart = { x: 0, y: 0 };

  // ---- Clipboard (Plan §3: Copiar/Cortar/Pegar) ----
  private clipboard: { nodes: NodeData[], edges: EdgeData[] } | null = null;

  // ---- Find & Zoom (Plan §3: Navegación Visual) ----
  showSearchPanel = false;
  searchQuery = '';
  searchResults: NodeData[] = [];

  // ---- Zoom & Pan (Plan §3) ----
  viewBoxX = 0;
  viewBoxY = 0;
  viewBoxW = 3000;
  viewBoxH = 2000;
  zoomLevel = 1;

  // ---- Bottleneck Detection (Plan §4) ----
  bottleneckNodeIds: string[] = [];

  private socketSubscription: Subscription | null = null;
  private presenceSubscription: Subscription | null = null;
  private assistantSubscriptions: Subscription[] = [];
  private assistantStreamsBound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private designService: DesignService,
    private socketService: ModelingSocketService,
    private iaService: IaService,
    private message: NzMessageService,
    private processInstanceService: ProcessInstanceService,
    private geminiLive: GeminiLiveService,
    private ngZone: NgZone
  ) {
    this.designId = this.route.snapshot.paramMap.get('designId');
  }

  // ===== LIFECYCLE =====

  ngOnInit(): void {
    // isReadOnly is now a getter
    if (this.designId) {
      this.loadDesignDetails();
      this.loadInitialData();
      this.connectToSocket();
      if (this.isReadOnly) {
        this.loadActiveInstance();
      }
    }
  }

  ngOnDestroy(): void {
    this.socketSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.assistantSubscriptions.forEach(s => s.unsubscribe());
    this.assistantSubscriptions = [];
    this.socketService.disconnect();
  }

  // ===== DATA LOADING =====
  loadDesignDetails() {
    this.designService.getDesignById(this.designId!).subscribe({
      next: (design) => {
        this.projectId = design.projectId;
        this.layoutType = design.layoutType || 'vertical';
      },
      error: (err) => { /* Error handled silently */ }
    });
  }
  
  goBackToDesigns() {
    const parent = this.isReadOnly ? 'staff' : 'designer';
    if (this.projectId) {
      this.router.navigate([`/${parent}/projects`, this.projectId, 'designs']);
    } else {
      this.router.navigate([`/${parent}/projects`]);
    }
  }

  loadInitialData() {
    this.designService.getModelingByDesignId(this.designId!).subscribe({
      next: (modeling: Modeling) => {
        this.modelingId = modeling.id || null;
        this.nodes = modeling.nodes || [];
        this.edges = modeling.edges || [];
        this.nodes
          .filter(n => n.type === 'swimlane')
          .forEach(lane => {
            lane.width = Math.max(lane.width || 0, 300);
            lane.height = Math.max(lane.height || 0, 520);
          });
        this.saveHistory();
        setTimeout(() => this.zoomFit(), 100);
      },
      error: (err) => { /* Error handled silently */ }
    });
  }

  connectToSocket() {
    this.lastReceivedTimestamp = 0;
    this.socketSubscription = this.socketService.connect(this.designId!).subscribe({
      next: (m: Modeling) => {
        if (m.type === 'force_sync') {
           this.ngZone.run(() => {
             this.message.warning(m.error || 'Colisión detectada. Sincronizando lienzo...');
             this.nodes = m.nodes || [];
             this.edges = m.edges || [];
             this.lastReceivedTimestamp = Date.now();
           });
           return;
        }

        if (m.senderId === this.socketService.currentUserId) return;
        if (m.timestamp && m.timestamp < this.lastReceivedTimestamp) return;
        this.lastReceivedTimestamp = m.timestamp || 0;
        
        const remoteNodes = m.nodes || [];
        
        // ---- HIGH SPEED PULSE PATH (runs OUTSIDE zone for max FPS) ----
        if (m.isDragPulse) {
          remoteNodes.forEach(rn => {
             if (this.isDragging && this.draggedNode?.id === rn.id) return;
             
             const ln = this.nodes.find(n => n.id === rn.id);
             if (ln) { 
                Object.assign(ln, rn);
                
                const el = document.getElementById('node-' + rn.id);
                if (el) {
                   if (rn.type === 'swimlane') {
                     el.setAttribute('x', rn.x.toString());
                     el.setAttribute('y', rn.y.toString());
                     el.setAttribute('width', (rn.width || 300).toString());
                     el.setAttribute('height', (rn.height || 520).toString());
                     // Also update lane dimensions directly on the rect
                     const rect = el.querySelector('rect');
                     if (rect) {
                       rect.setAttribute('width', (rn.width || 300).toString());
                       rect.setAttribute('height', (rn.height || 520).toString());
                     }
                   } else {
                     el.setAttribute('transform', `translate(${rn.x},${rn.y})`);
                   }
                }
             } else {
               this.nodes = [...this.nodes, rn];
             }
          });
          
          const remoteEdges = m.edges || [];
          remoteEdges.forEach(re => {
             const le = this.edges.find(e => e.id === re.id);
             if (le) {
               Object.assign(le, re);
             } else {
               this.edges = [...this.edges, re];
             }
          });
          
          // Direct DOM Manipulation for zero latency on EDGES
          this.edges.forEach(le => {
             const newPath = this.getConnectorPath(le);
             const fatEl = document.getElementById('edge-fat-' + le.id);
             if (fatEl) fatEl.setAttribute('d', newPath);
             
             const visEl = document.getElementById('edge-vis-' + le.id);
             if (visEl) visEl.setAttribute('d', newPath);
             
             if (le.label) {
                const lblEl = document.getElementById('edge-lbl-' + le.id);
                if (lblEl) {
                   lblEl.setAttribute('x', this.getLabelX(le).toString());
                   lblEl.setAttribute('y', this.getLabelY(le).toString());
                }
             }
          });
          
          return;
        }

        // ---- STANDARD SYNC PATH (runs INSIDE zone to trigger Angular re-render) ----
        this.ngZone.run(() => {
          const remoteEdges = m.edges || [];

          // Actualización atómica de nodos para evitar descalces entre calles y componentes
          this.nodes = remoteNodes.map(rn => {
            const local = this.nodes.find(n => n.id === rn.id);
            // Si yo estoy arrastrando este nodo, preservo mi posición local para evitar saltos (jitters)
            if (local && this.isDragging && this.draggedNode?.id === rn.id) {
              return { ...rn, x: local.x, y: local.y }; 
            }
            return rn;
          });

          this.edges = remoteEdges.map(re => {
            const local = this.edges.find(e => e.id === re.id);
            if (local && this.dragWaypoint && this.dragWaypoint.edgeId === re.id) {
              return { ...re, waypoints: local.waypoints };
            }
            return re;
          });
          
          // Forzar sincronización de atributos DOM después de un cambio de estado masivo
          if (!m.isDragPulse) {
            setTimeout(() => {
              this.nodes.forEach(n => {
                const el = document.getElementById('node-' + n.id);
                if (el) {
                  if (n.type === 'swimlane') {
                    el.setAttribute('x', n.x.toString());
                    el.setAttribute('width', (n.width || 300).toString());
                  } else {
                    el.setAttribute('transform', `translate(${n.x},${n.y})`);
                  }
                }
              });
            }, 0);
          }
        });
      },
      error: (err) => { /* Error handled silently */ }
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
    if (this.isReadOnly) return;
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.undo();
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      this.redo();
    } else if (event.ctrlKey && event.key === 'c') {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.copySelection();
      }
    } else if (event.ctrlKey && event.key === 'x') {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.cutSelection();
      }
    } else if (event.ctrlKey && event.key === 'v') {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.pasteClipboard();
      }
    } else if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      this.toggleSearch();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        if (this.selectedNodes.length > 0) {
          // Multi-delete
          const ids = new Set(this.selectedNodes.map(n => n.id));
          this.nodes = this.nodes.filter(n => !ids.has(n.id));
          this.edges = this.edges.filter(e => !ids.has(e.source) && !ids.has(e.target));
          this.selectedNodes = [];
          this.broadcastUpdate();
        } else if (this.selectedNode) {
          this.deleteNode();
        } else if (this.selectedEdge) {
          this.deleteEdge();
        }
      }
    } else if (event.key === 'Escape') {
      this.isConnectingMode = false;
      this.showAiPanel = false;
      this.showSearchPanel = false;
      this.selectedNodes = [];
    }
  }

  // ===== BROADCASTING =====

  broadcastUpdate(shouldSaveHistory = true, isDragPulse = false) {
    if (this.designId) {
      // Game-Mode Delta Packets: if dragging, only send the moved node
      let modeling: Modeling;
      modeling = {
        id: this.modelingId || undefined,
        // Clone arrays to ensure fresh state is sent and change detection is triggered locally
        nodes: [...this.nodes],
        edges: [...this.edges],
        isDragPulse: isDragPulse,
        senderId: this.socketService.currentUserId,
        timestamp: Date.now()
      };
      
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
    if (this.isReadOnly) return;
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
    if (node.type === 'swimlane') {
      this.tempLaneWidth = node.width || 300;
      this.tempLaneHeight = node.height || 520;
    }
  }

  selectEdge(edge: EdgeData, event: MouseEvent) {
    if (this.isReadOnly) return;
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
    this.edges = [...this.edges, newEdge];
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
    if (this.isReadOnly) return;
    event.stopPropagation();
    if (!edge.waypoints) edge.waypoints = [];
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    edge.waypoints = [...(edge.waypoints || []), { x: svgPt.x, y: svgPt.y }];
    this.broadcastUpdate();
  }

  startWaypointDrag(event: MouseEvent, edgeId: string, index: number) {
    if (this.isReadOnly) return;
    event.stopPropagation();
    this.dragWaypoint = { edgeId, index };
  }

  // Allow creating a waypoint by dragging the line
  startLineDrag(event: MouseEvent, edge: EdgeData) {
    if (this.isReadOnly || this.isConnectingMode) return;
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
    if (this.isReadOnly) return;
    event.stopPropagation();
    if (edge.waypoints) {
      edge.waypoints.splice(index, 1);
      this.broadcastUpdate();
    }
  }

  // ===== DRAG & DROP =====

  onMouseDown(node: NodeData, event: MouseEvent) {
    if (this.isReadOnly) return;
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
      const laneW = node.width || 300;
      const oldX = node.x;
      
      // Capturar hijos (actividades)
      this.draggedChildren = this.nodes.filter(n => {
        if (n.type === 'swimlane') return false;
        const nodeCenterX = n.x + (n.width || 160) / 2;
        return nodeCenterX >= oldX - 5 && nodeCenterX <= oldX + laneW + 5;
      });

      // Capturar waypoints de flechas
      this.draggedWaypoints = [];
      this.edges.forEach(e => {
        if (e.waypoints) {
          e.waypoints.forEach(wp => {
            if (wp.x >= oldX - 5 && wp.x <= oldX + laneW + 5) {
              this.draggedWaypoints.push(wp);
            }
          });
        }
      });
    } else {
      this.draggedChildren = [];
      this.draggedWaypoints = [];
    }
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.svgElement || this.isReadOnly) return;
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
        const oldX = this.draggedNode.x;
        const nextX = newX; // Permitir valores negativos para facilitar el reordenamiento al inicio
        const deltaX = nextX - oldX;

        this.draggedNode.x = nextX;
        this.draggedNode.y = 0;

        // Mover hijos capturados en tiempo real
        this.draggedChildren.forEach(child => {
          child.x += deltaX;
          const el = document.getElementById('node-' + child.id);
          if (el) el.setAttribute('transform', `translate(${child.x},${child.y})`);
        });

        // Mover waypoints capturados
        if (this.draggedWaypoints) {
          this.draggedWaypoints.forEach(wp => wp.x += deltaX);
        }

        // Reorganizar el resto de calles
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
    const allLanes = this.nodes.filter(n => n.type === 'swimlane');
    if (allLanes.length < 2 && !isDragging) return;

    // Ordenar carriles por su posición X actual
    const sortedLanes = [...allLanes].sort((a, b) => a.x - b.x);

    let currentX = 0;
    sortedLanes.forEach(lane => {
      const oldX = lane.x;
      const laneW = lane.width || 300;
      
      if (isDragging && this.draggedNode?.id === lane.id) {
        // La calle que estoy arrastrando ya movió sus propios hijos en onMouseMove
        currentX += laneW;
      } else {
        // Las calles que NO estoy arrastrando se acomodan automáticamente
        const newX = currentX;
        const deltaX = newX - oldX;
        
        lane.x = newX;
        lane.y = 0;

        // Mover hijos con la lógica de centro
        this.nodes.forEach(n => {
          if (n.type !== 'swimlane') {
            // CRITICAL: If this node is already being dragged as a child of another lane, DON'T touch it
            if (isDragging && this.draggedChildren.some(dc => dc.id === n.id)) {
              return;
            }

            const nodeCenterX = n.x + (n.width || 160) / 2;
            if (nodeCenterX >= oldX - 5 && nodeCenterX <= oldX + laneW + 5) {
              n.x += deltaX;
              if (isDragging) {
                const el = document.getElementById('node-' + n.id);
                if (el) el.setAttribute('transform', `translate(${n.x},${n.y})`);
              }
            }
          }
        });

        // Mover waypoints de flechas
        this.edges.forEach(e => {
          if (e.waypoints) {
            e.waypoints.forEach(wp => {
              // CRITICAL: If this waypoint is already being dragged, DON'T touch it
              if (isDragging && this.draggedWaypoints.includes(wp)) {
                return;
              }

              if (wp.x >= oldX - 5 && wp.x <= oldX + laneW + 5) {
                wp.x += deltaX;
              }
            });
          }
        });

        currentX += laneW;
      }
    });

    this.checkAndExpandLanes();
  }

  onLaneUpdate() {
    this.syncLanesLayout();
    this.checkAndExpandLanes();
    this.broadcastUpdate();
  }

  // Métodos para actualizar dimensiones solo cuando se termina de editar
  commitLaneWidth() {
    if (this.selectedNode && this.selectedNode.type === 'swimlane') {
      this.selectedNode.width = this.tempLaneWidth;
      this.onLaneUpdate();
    }
  }

  commitLaneHeight() {
    if (this.selectedNode && this.selectedNode.type === 'swimlane') {
      this.selectedNode.height = this.tempLaneHeight;
      this.onLaneUpdate();
    }
  }

  onNodeUpdate() {
    this.checkAndExpandLanes();
    this.broadcastUpdate();
  }

  checkAndExpandLanes() {
    const lanes = this.nodes.filter(n => n.type === 'swimlane');
    const otherNodes = this.nodes.filter(n => n.type !== 'swimlane');
    
    // Calculate required height based on vertical flow
    let maxBottom = 520;
    otherNodes.forEach(node => {
      const bottom = node.y + (node.height || 80) + 100;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    
    // Apply to ALL lanes to keep them aligned
    lanes.forEach(lane => { 
      lane.height = maxBottom; 
    });
  }

  // ===== NODE CRUD =====

  addNode(type: string) {
    let x = 100, y = 200;
    if (type === 'swimlane') {
      // Carriles lado a lado como columnas amplias
      const lanes = this.nodes.filter(n => n.type === 'swimlane');
      x = lanes.length > 0 ? Math.max(...lanes.map(l => l.x + (l.width || 300))) : 0;
      y = 0;
    } else {
      const firstLane = this.nodes.find(n => n.type === 'swimlane');
      if (firstLane) { 
        y = firstLane.y + 50;
        x = firstLane.x + 50;
      }
    }

    const dims: Record<string, [number, number]> = {
      swimlane: [300, 520],  // Carril vertical con encabezado arriba y cuerpo hacia abajo
      decision: [120, 100], parallel: [120, 100],
      start: [40, 40], end: [40, 40]
    };
    const [defaultW, defaultH] = dims[type] || [160, 80];

    // Generar nombre automático para swimlane
    let label: string;
    if (type === 'swimlane') {
      label = this.getNextLaneName();
    } else {
      const baseLabel = type === 'decision' ? 'Condición?' : undefined;
      label = this.getNextDefaultNodeName(type, baseLabel);
    }

    const newNode: NodeData = {
      id: `${type}_${Date.now()}`,
      type, x, y,
      label,
      width: defaultW, height: defaultH, fontSize: 12
    };

    this.nodes = [...this.nodes, newNode];
    this.selectedNode = newNode;
    this.checkAndExpandLanes();
    this.broadcastUpdate();
  }

  // Helper: generar nombre secuencial para calles
  private getNextLaneName(): string {
    const lanes = this.nodes.filter(n => n.type === 'swimlane');
    const used = new Set<number>();
    for (const lane of lanes) {
      const m = (lane.label || '').match(/^Calle\s+(\d+)$/i);
      if (m) used.add(Number(m[1]));
    }
    let i = 1;
    while (used.has(i)) i += 1;
    return `Calle ${i}`;
  }

  // Helper: Autonumerar nombres de nodos si están duplicados (Evita "Nueva Actividad", "Nueva Actividad")
  private getNextDefaultNodeName(type: string, baseLabel?: string): string {
    const basenames: Record<string, string> = {
      decision: 'Decisión',
      subprocess: 'Subproceso',
      start: 'Inicio',
      end: 'Fin',
      activity: 'Actividad',
      datastore: 'Datos'
    };

    let prefix = baseLabel?.trim();
    if (prefix) {
       // Filter out "Nueva " prefix if LLM forcefully inferred it from previous NLP context
       prefix = prefix.replace(/^(Nueva|Nuevo)\s+/i, '');
    }

    if (!prefix) {
      prefix = basenames[type] || `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }

    const exactExists = this.nodes.some(n => n.label === prefix);
    if (!exactExists) return prefix;

    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}\\s+(\\d+)$`, 'i');
    let maxN = 1;

    for (const node of this.nodes) {
      const match = (node.label || '').trim().match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxN) maxN = num;
      }
    }

    return `${prefix} ${maxN + 1}`;
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

  getFormsForSelectedEdge(): Form[] {
    if (this.selectedEdge) {
      if (!this.selectedEdge.forms) this.selectedEdge.forms = [];
      return this.selectedEdge.forms;
    }
    return [];
  }

  addEdgeFormField() {
    if (this.isReadOnly) return;
    if (this.selectedEdge) {
      if (!this.selectedEdge.forms) this.selectedEdge.forms = [];
      this.selectedEdge.forms.push({
        modelingId: this.modelingId || '',
        label: 'Nuevo Campo de Datos',
        type: 'text',
        required: false
      });
      this.broadcastUpdate();
    }
  }

  removeEdgeFormField(index: number) {
    if (this.selectedEdge && this.selectedEdge.forms) {
      this.selectedEdge.forms.splice(index, 1);
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

    // Build path with rounded corners (Bzier)
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

      const r1 = len1 > 0 ? r / len1 : 0;
      const r2 = len2 > 0 ? r / len2 : 0;

      const start = { x: p2.x + d1.x * r1, y: p2.y + d1.y * r1 };
      const end = { x: p2.x + d2.x * r2, y: p2.y + d2.y * r2 };

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
    this.aiLastMessage = ` Procesando: "${cmd}"...`;

    this.iaService.processCommand(cmd, this.nodes, this.edges).subscribe({
      next: (response) => {
        this.aiLoading = false;
        this.aiLastMessage = ' ' + (response.user_feedback || response.explanation || 'Comando ejecutado exitosamente');
        if (response.umlValidation) {
          this.message.warning(` UML: ${response.umlValidation}`);
        }
        this.executeAiCommands(response.commands);
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiLastMessage = ' Error al procesar el comando. Intenta de nuevo.';
      }
    });
  }

  executeAiCommands(commands: DiagramCommand[]) {
    for (const cmd of commands) {
      switch (cmd.action) {

        // === NODE MANAGEMENT ===
        case 'add_node': {
          const dims: Record<string, [number, number]> = {
            swimlane: [300, 520],
            decision: [120, 100], parallel: [120, 100],
            start: [40, 40], end: [40, 40], datastore: [80, 60]
          };
          const type = cmd.nodeType || 'activity';

          // UML: prevent duplicate start nodes
          if (type === 'start' && this.nodes.some(n => n.type === 'start')) {
            this.message.warning(' UML: Ya existe un nodo de inicio. Solo se permite uno.');
            break;
          }

          const [w, h] = dims[type] || [160, 80];

          // Smart positioning: place inside target lane if one exists
          let posY = cmd.y ?? 200;
          let posX = cmd.x ?? 200;
          if (type === 'swimlane') {
            // Carriles lado a lado como columnas amplias
            const lanes = this.nodes.filter(n => n.type === 'swimlane');
            posX = lanes.length > 0 ? Math.max(...lanes.map(l => l.x + (l.width || 300))) : 0;
            posY = 0;
          } else if (cmd.targetLaneName || !cmd.y) {
            // Auto-position inside the requested target lane (or first lane if none specified)
            const laneNameQuery = cmd.targetLaneName ? cmd.targetLaneName.toLowerCase() : null;
            const targetLane = laneNameQuery 
              ? this.nodes.find(n => n.type === 'swimlane' && (n.label || '').toLowerCase().includes(laneNameQuery))
              : this.nodes.find(n => n.type === 'swimlane');

            if (targetLane) {
              const existingInLane = this.nodes.filter(n => 
                n.type !== 'swimlane' && 
                n.x >= targetLane.x && n.x < targetLane.x + (targetLane.width || 300)
              );
              const maxY = existingInLane.length > 0 
                ? Math.max(...existingInLane.map(n => n.y + (n.height || 80))) 
                : targetLane.y + 70;
              
              posY = maxY + 40;
              posX = targetLane.x + 50;
            }
          }

          // Generar label por defecto y aplicar autoincremento para evitar duplicados
          let defaultLabel: string;
          if (type === 'swimlane') {
            defaultLabel = cmd.label && cmd.label !== 'Nueva Calle' ? cmd.label : this.getNextLaneName();
          } else {
            let base = cmd.label && cmd.label.trim().length > 0 ? cmd.label : undefined;
            if (base) base = base.replace(/^(Nueva|Nuevo)\s+/i, '');
            defaultLabel = this.getNextDefaultNodeName(type, base);
          }

          const newForms = (cmd.forms || []).map(f => ({
            ...f,
            modelingId: this.modelingId || ''
          }));

          this.nodes.push({
            id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            type, x: posX, y: posY,
            label: defaultLabel,
            width: cmd.width || w, height: cmd.height || h,
            fontSize: cmd.fontSize || 12,
            responsible: cmd.responsible,
            forms: newForms
          });
          break;
        }

        case 'delete_node': {
          const query = (cmd.nodeId || cmd.label || '').toLowerCase().trim();
          const toDeleteNode = this.nodes.find(n => 
            n.id === cmd.nodeId || 
            (n.label || '').toLowerCase().trim() === query
          );
          if (toDeleteNode) {
            const toDeleteId = toDeleteNode.id;
            this.nodes = this.nodes.filter(n => n.id !== toDeleteId);
            this.edges = this.edges.filter(e => e.source !== toDeleteId && e.target !== toDeleteId);
            this.syncLanesLayout(false);
          }
          break;
        }

        case 'update_node': {
          const query = (cmd.nodeId || cmd.label || '').toLowerCase().trim();
          const n = this.nodes.find(n => 
            (cmd.nodeId && n.id === cmd.nodeId) || 
            (!cmd.nodeId && (n.label || '').toLowerCase().trim() === query)
          );
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
            if (cmd.forms !== undefined) {
              n.forms = cmd.forms.map(f => ({
                ...f,
                modelingId: this.modelingId || ''
              }));
            }
          }
          break;
        }

        // === EDGE MANAGEMENT ===
        case 'add_edge': {
          const srcQ = (cmd.sourceId || '').toLowerCase().trim();
          const tgtQ = (cmd.targetId || '').toLowerCase().trim();
          const srcNode = this.nodes.find(n => n.id === cmd.sourceId || (n.label || '').toLowerCase().trim() === srcQ);
          const tgtNode = this.nodes.find(n => n.id === cmd.targetId || (n.label || '').toLowerCase().trim() === tgtQ);
          if (srcNode && tgtNode) {
            this.edges.push({
              id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              source: srcNode.id, target: tgtNode.id,
              label: cmd.edgeLabel || cmd.label,
              style: (cmd.edgeStyle as any) || 'solid',
              color: cmd.edgeColor || '#455a64',
              strokeWidth: cmd.edgeThickness || 2, opacity: 100, waypoints: []
            });
          }
          break;
        }

        case 'delete_edge': {
          if (cmd.edgeId) {
            this.edges = this.edges.filter(e => e.id !== cmd.edgeId);
          } else if (cmd.sourceId && cmd.targetId) {
            const srcQ = (cmd.sourceId || '').toLowerCase().trim();
            const tgtQ = (cmd.targetId || '').toLowerCase().trim();
            const src = this.nodes.find(n => n.id === cmd.sourceId || (n.label || '').toLowerCase().trim() === srcQ);
            const tgt = this.nodes.find(n => n.id === cmd.targetId || (n.label || '').toLowerCase().trim() === tgtQ);
            if (src && tgt) {
              this.edges = this.edges.filter(e => !(e.source === src.id && e.target === tgt.id));
            }
          } else if (cmd.sourceId) {
            const srcQ = (cmd.sourceId || '').toLowerCase().trim();
            const node = this.nodes.find(n => n.id === cmd.sourceId || (n.label || '').toLowerCase().trim() === srcQ);
            if (node) {
              this.edges = this.edges.filter(e => e.source !== node.id && e.target !== node.id);
            }
          }
          break;
        }

        case 'update_edge': {
          let e: EdgeData | undefined;
          if (cmd.edgeId) {
            e = this.edges.find(e => e.id === cmd.edgeId);
          } else if (cmd.sourceId && cmd.targetId) {
            const srcQ = (cmd.sourceId || '').toLowerCase().trim();
            const tgtQ = (cmd.targetId || '').toLowerCase().trim();
            const src = this.nodes.find(n => n.id === cmd.sourceId || (n.label || '').toLowerCase().trim() === srcQ);
            const tgt = this.nodes.find(n => n.id === cmd.targetId || (n.label || '').toLowerCase().trim() === tgtQ);
            if (src && tgt) {
              e = this.edges.find(e => 
                (e.source === src.id && e.target === tgt.id) || 
                (e.source === tgt.id && e.target === src.id)
              );
            }
          }
          if (e) {
            if (cmd.edgeLabel !== undefined) e.label = cmd.edgeLabel;
            if (cmd.label !== undefined) e.label = cmd.label;
            if (cmd.edgeStyle !== undefined) e.style = cmd.edgeStyle as any;
            if (cmd.edgeColor !== undefined) e.color = cmd.edgeColor;
            if (cmd.edgeThickness !== undefined) e.strokeWidth = cmd.edgeThickness;
          }
          break;
        }

        // === SWIMLANE OPERATIONS ===
        case 'move_node_to_lane': {
          const query = (cmd.nodeId || cmd.label || '').toLowerCase().trim();
          const node = this.nodes.find(n => 
            (cmd.nodeId && n.id === cmd.nodeId) || 
            (!cmd.nodeId && (n.label || '').toLowerCase().trim() === query)
          );
          const laneQ = (cmd.targetLaneName || '').toLowerCase().trim();
          const targetLane = this.nodes.find(n =>
            n.type === 'swimlane' && (n.label || '').toLowerCase().trim() === laneQ
          );
          if (node && targetLane) {
            // Carriles verticales: nodos dentro se colocan de arriba a abajo, centrados
            node.x = targetLane.x + ((targetLane.width || 300) / 2) - ((node.width || 160) / 2);
            // Keep Y or adjust if outside lane bounds
            if (node.y < targetLane.y + 40) node.y = targetLane.y + 50;
          } else if (!targetLane && cmd.targetLaneName) {
            this.message.warning(` Carril "${cmd.targetLaneName}" no encontrado.`);
          }
          break;
        }

        case 'reorder_lanes': {
          if (cmd.laneOrder && cmd.laneOrder.length > 0) {
            const laneNodes = this.nodes.filter(n => n.type === 'swimlane');
            
            // 1. Mapear qué nodos y waypoints pertenecen a qué calle actualmente (ESTÁTICO)
            const laneMap = new Map<string, { nodes: NodeData[], waypoints: {x: number, y: number}[] }>();
            
            laneNodes.forEach(lane => {
              const oldX = lane.x;
              const laneW = lane.width || 300;
              
              const nodesInLane = this.nodes.filter(n => {
                if (n.type === 'swimlane') return false;
                const nodeCenterX = n.x + (n.width || 160) / 2;
                return nodeCenterX >= oldX - 5 && nodeCenterX <= oldX + laneW + 5;
              });

              const wpsInLane: {x: number, y: number}[] = [];
              this.edges.forEach(e => {
                if (e.waypoints) {
                  e.waypoints.forEach(wp => {
                    if (wp.x >= oldX - 5 && wp.x <= oldX + laneW + 5) {
                      wpsInLane.push(wp);
                    }
                  });
                }
              });

              laneMap.set(lane.label || '', { nodes: nodesInLane, waypoints: wpsInLane });
            });

            // 2. Ejecutar el movimiento basado en el mapeo previo
            let nextX = 0;
            for (const laneName of cmd.laneOrder) {
              const lane = laneNodes.find(n => n.label === laneName);
              const mapping = laneMap.get(laneName);
              
              if (lane && mapping) {
                const deltaX = nextX - lane.x;
                
                // Mover calle
                lane.x = nextX;
                lane.y = 0;

                // Mover sus nodos hijos
                mapping.nodes.forEach(n => n.x += deltaX);
                
                // Mover sus waypoints
                mapping.waypoints.forEach(wp => wp.x += deltaX);

                nextX += (lane.width || 300);
              }
            }

            // 3. Sincronizar cambios
            if (this.socketService && this.modelingId) {
              this.socketService.sendUpdate(this.modelingId, {
                nodes: this.nodes,
                edges: this.edges,
                senderId: this.socketService.currentUserId,
                timestamp: Date.now()
              });
            }
          }
          break;
        }

        // === RECONNECT & REROUTE ===
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

        // === BATCH STYLE ===
        case 'batch_update_style': {
          if (cmd.targetType === 'edge') {
            this.edges.forEach(e => {
              if (cmd.edgeThickness !== undefined) e.strokeWidth = cmd.edgeThickness;
              if (cmd.edgeColor !== undefined) e.color = cmd.edgeColor;
              if (cmd.edgeStyle !== undefined) e.style = cmd.edgeStyle as any;
            });
          } else if (cmd.targetType) {
            this.nodes.filter(n => n.type === cmd.targetType).forEach(n => {
              if (cmd.fontSize !== undefined) n.fontSize = cmd.fontSize;
              if (cmd.width !== undefined) n.width = cmd.width;
              if (cmd.height !== undefined) n.height = cmd.height;
            });
          }
          break;
        }

        // === AUTO LAYOUT ===
        case 'auto_layout': {
          // Carriles verticales lado a lado, flujo de arriba a abajo dentro de cada carril
          const lanes = this.nodes.filter(n => n.type === 'swimlane').sort((a, b) => a.x - b.x);
          const nonLanes = this.nodes.filter(n => n.type !== 'swimlane');
          
          if (lanes.length === 0) {
            // No lanes: simple vertical layout
            let y = 100;
            nonLanes.forEach(n => {
              n.x = 100;
              n.y = y;
              y += (n.height || 80) + 60;
            });
          } else {
            // Group nodes by lane, then layout within each vertically
            lanes.forEach(lane => {
              const laneNodes = nonLanes.filter(n =>
                n.x >= lane.x && n.x < lane.x + (lane.width || 300)
              );
              let y = lane.y + 50;
              laneNodes.forEach(n => {
                n.x = lane.x + ((lane.width || 300) / 2) - ((n.width || 160) / 2);
                n.y = y;
                y += (n.height || 80) + 60;
              });
            });
          }
          break;
        }

        // === CLEAR ALL ===
        case 'clear_all':
          this.nodes = [];
          this.edges = [];
          break;

        // === CLEAR LANE ===
        case 'clear_lane': {
          const lane = this.nodes.find(n => n.type === 'swimlane' && (n.label || '').toLowerCase() === (cmd.targetLaneName || '').toLowerCase());
          if (lane) {
            const laneX = lane.x;
            const laneY = lane.y;
            const laneW = lane.width || 300;
            const laneH = lane.height || 520;
            
            const nodesToDelete = this.nodes.filter(n => 
              n.type !== 'swimlane' &&
              n.x >= laneX && n.x < laneX + laneW &&
              n.y >= laneY && n.y <= laneY + laneH
            ).map(n => n.id);
            
            this.nodes = this.nodes.filter(n => !nodesToDelete.includes(n.id));
            this.edges = this.edges.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target));
          } else {
            this.message.warning(`Carril "${cmd.targetLaneName}" no encontrado.`);
          }
          break;
        }

        // === ZOOM ===
        case 'zoom_fit':
          this.zoomFit();
          break;
        case 'zoom_canvas':
          if (cmd.zoomLevel) {
            this.zoomLevel = cmd.zoomLevel;
            this.viewBoxW = 3000 / this.zoomLevel;
            this.viewBoxH = 2000 / this.zoomLevel;
            this.applyViewBox();
          }
          break;

        case 'navigate':
          if (cmd.targetPath !== undefined) {
            this.message.loading(`Navegando a: ${cmd.targetPath}...`);
            setTimeout(() => {
              this.router.navigate([cmd.targetPath]);
            }, 1500);
          }
          break;

        case 'open_settings':
          this.showSettings = true;
          this.message.info('Abriendo panel de ajustes...');
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
        // Auto-enviar al terminar de hablar para mayor velocidad
        setTimeout(() => this.sendAiCommand(), 300);
      };
      this.recognition.onend = () => { 
        this.isListening = false; 
      };
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
      this.aiLastMessage = 'Escuchando... Habla ahora';
      this.recognition.start();
    }
  }

  // ===== VALIDATION (RF-9) =====
  validateDiagram() {
    if (!this.designId) return;
    this.processInstanceService.validateDiagram(this.designId).subscribe({
      next: (result) => {
        this.validationResult = result;
        this.showValidation = true;
        if (result.valid) {
          this.message.success(' Diagrama vlido: ' + result.nodeCount + ' nodos, ' + result.edgeCount + ' aristas');
        } else {
          this.message.warning(' Se encontraron ' + result.errors.length + ' errores y ' + result.warnings.length + ' advertencias');
        }
      },
      error: () => this.message.error('Error al validar diagrama')
    });
  }

  // ===== TTS (RF-17) =====
  speakLastAi() {
    if (this.aiLastMessage) {
      this.geminiLive.speakElevenLabs(this.aiLastMessage);
    } else {
      this.message.info('No hay respuesta IA para leer');
    }
  }

  // =========== VOICE ASSISTANT (Gemini Live + Groq + ElevenLabs) ===========

  private visionInterval: any;

  async toggleAssistant() {
    this.showAssistantPanel = !this.showAssistantPanel;
    if (this.showAssistantPanel) {
      if (!this.assistantStreamsBound) {
        this.assistantStreamsBound = true;
        this.assistantSubscriptions.push(
          this.geminiLive.messages$.subscribe(msg => {
            this.assistantHistory.push(msg);
            this.assistantThinking = false;
            this.scrollAssistantToBottom();
          })
        );
        this.assistantSubscriptions.push(
          this.geminiLive.isListening$.subscribe(v => this.assistantListening = v)
        );
        this.assistantSubscriptions.push(
          this.geminiLive.isSpeaking$.subscribe(v => this.assistantSpeaking = v)
        );
        this.assistantSubscriptions.push(
          this.geminiLive.isConnected$.subscribe(v => this.assistantConnected = v)
        );
        this.assistantSubscriptions.push(
          this.geminiLive.commands$.subscribe(cmds => {
            this.executeAiCommands(cmds);
          })
        );
      }

      try {
        await this.geminiLive.connect();
        this.message.success('Guía Personal conectado');
        
        this.visionInterval = setInterval(() => {
          if (this.assistantConnected) {
            this.geminiLive.captureCanvas(this.svgElement.nativeElement);
          }
        }, 5000);

      } catch (e) {
        this.message.error('Error al conectar con Tonny');
      }
    } else {
      this.geminiLive.disconnect();
      if (this.visionInterval) clearInterval(this.visionInterval);
    }
  }

  toggleContinuousMode() {
    this.continuousListening = this.geminiLive.toggleContinuousListening();
  }

  toggleAssistantVoice() {
    this.geminiLive.setDiagramContext(this.nodes, this.edges);
    this.geminiLive.startVoiceInput().catch(() => {
      this.message.warning('Tu navegador no soporta reconocimiento de voz');
    });
  }

  sendAssistantQuery() {
    const query = this.assistantInput.trim();
    if (!query || this.assistantThinking) return;
    this.assistantInput = '';
    this.assistantThinking = true;
    this.scrollAssistantToBottom();
    
    // Siempre actualizar contexto antes de enviar
    this.geminiLive.setDiagramContext(this.nodes, this.edges);
    this.geminiLive.sendText(query);
  }

  stopSpeaking() {
    this.geminiLive.stopAudio();
  }

  async runAudit() {
    this.errorNodeIds = [];
    const result = await this.geminiLive.auditDiagram(this.nodes, this.edges);
    this.assistantHistory.push({ role: 'assistant', content: 'AUDITORIA DEL DIAGRAMA\n\n' + result });
    this.showAssistantPanel = true;
    this.scrollAssistantToBottom();
    this.errorNodeIds = this.nodes
      .filter(n => { const label = (n.label || '').toLowerCase(); return label.length > 2 && result.toLowerCase().includes(label); })
      .map(n => n.id);
    if (this.errorNodeIds.length > 0) {
      this.message.warning(this.errorNodeIds.length + ' nodo(s) con errores resaltados');
      setTimeout(() => { this.errorNodeIds = []; }, 15000);
    } else {
      this.message.success('Auditoria completada');
    }
    this.geminiLive.speakElevenLabs('Auditoría del diagrama: ' + result);
  }

  formatAssistantMsg(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;">$1</code>');
  }

  private scrollAssistantToBottom() {
    setTimeout(() => {
      const el = document.querySelector('.assistant-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }

  // ===== EXECUTION ENGINE (Staff) =====

  loadActiveInstance() {
    if (!this.designId) return;
    this.processInstanceService.getByDesign(this.designId).subscribe({
      next: (instances) => {
        const active = instances.find((i: any) => i.status === 'ACTIVE');
        if (active) {
          this.processInstance = active;
          this.isExecuting = true;
          this.syncExecutionState();
        }
      }
    });
  }

  syncExecutionState() {
    if (!this.processInstance) return;
    // Find the current IN_PROCESS or IN_REVIEW node
    const current = this.processInstance.activities.find(
      (a: any) => a.status === 'IN_PROCESS' || a.status === 'IN_REVIEW'
    );
    if (current) {
      this.currentExecutionNodeId = current.nodeId;
      this.selectedNode = this.nodes.find(n => n.id === current.nodeId) || null;
      this.initFormChecks();
    }
  }

  initFormChecks() {
    this.formChecks = {};
    if (this.selectedNode?.forms) {
      this.selectedNode.forms.forEach(f => {
        this.formChecks[f.label] = false;
      });
    }
  }

  getNodeStatus(nodeId: string): string {
    if (!this.processInstance) return '';
    const act = this.processInstance.activities.find((a: any) => a.nodeId === nodeId);
    return act ? act.status : '';
  }

  startActivity() {
    if (!this.designId) return;
    this.processInstanceService.startProcess(this.designId, 'staff-user').subscribe({
      next: (instance) => {
        this.processInstance = instance;
        this.isExecuting = true;
        this.syncExecutionState();
        this.message.success('Ejecución iniciada desde el nodo inicial.');
      },
      error: (err) => {
        this.message.error('Error al iniciar: ' + (err.error?.message || err.message));
      }
    });
  }

  get allFormsChecked(): boolean {
    if (!this.selectedNode?.forms || this.selectedNode.forms.length === 0) return true;
    return Object.values(this.formChecks).every(v => v === true);
  }

  get currentActivity(): any {
    if (!this.processInstance || !this.currentExecutionNodeId) return null;
    return this.processInstance.activities.find(
      (a: any) => a.nodeId === this.currentExecutionNodeId
    );
  }

  get isDecisionNode(): boolean {
    return this.selectedNode?.type === 'decision';
  }

  get outgoingEdges(): EdgeData[] {
    if (!this.currentExecutionNodeId) return [];
    return this.edges.filter(e => e.source === this.currentExecutionNodeId);
  }

  nextStep() {
    if (!this.processInstance || !this.currentExecutionNodeId) return;

    if (this.isDecisionNode) {
      this.message.warning('Selecciona un camino para la decisión.');
      return;
    }

    if (!this.allFormsChecked) {
      this.message.warning('Debe completar todos los formularios antes de avanzar.');
      return;
    }

    // Build form data from checks
    const formData: Record<string, any> = {};
    Object.entries(this.formChecks).forEach(([key, val]) => {
      formData[key] = val;
    });

    this.processInstanceService.advanceActivity(
      this.processInstance.id,
      this.currentExecutionNodeId,
      'FINISHED',
      formData,
      'staff-user'
    ).subscribe({
      next: (updated) => {
        this.processInstance = updated;
        this.syncExecutionState();
        if (updated.status === 'COMPLETED') {
          this.message.success('¡Proceso completado exitosamente!');
          this.isExecuting = false;
        } else {
          this.message.success('Actividad completada.');
        }
      },
      error: (err) => {
        this.message.error('Error: ' + (err.error?.message || err.message));
      }
    });
  }

  resolveDecisionPath(edge: EdgeData) {
    if (!this.processInstance || !this.currentExecutionNodeId) return;

    const formsOk = this.allFormsChecked;

    // If forms not checked and this is the "No" path, allow
    // If forms checked and this is the "Yes" path, allow
    this.processInstanceService.resolveDecision(
      this.processInstance.id,
      this.currentExecutionNodeId,
      edge.id,
      'staff-user'
    ).subscribe({
      next: (updated) => {
        this.processInstance = updated;
        this.syncExecutionState();
        this.message.info(`Decisión tomada: ${edge.label || 'camino seleccionado'}`);
      },
      error: (err) => {
        this.message.error('Error: ' + (err.error?.message || err.message));
      }
    });
  }

  stopExecution() {
    if (!this.processInstance) return;
    this.processInstanceService.cancelProcess(this.processInstance.id, 'staff-user').subscribe({
      next: () => {
        this.isExecuting = false;
        this.processInstance = null;
        this.currentExecutionNodeId = null;
        this.message.info('Ejecución cancelada.');
      }
    });
  }

  // ===== MULTI-SELECTION (Plan §3: Macro-Operaciones) =====

  startSelectionBox(event: MouseEvent) {
    if (this.isReadOnly || this.isDragging || this.isConnectingMode) return;
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    this.selectionStart = { x: svgPt.x, y: svgPt.y };
    this.selectionBox = { x: svgPt.x, y: svgPt.y, w: 0, h: 0 };
    this.isSelectionBoxActive = true;
  }

  updateSelectionBox(event: MouseEvent) {
    if (!this.isSelectionBoxActive) return;
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    this.selectionBox = {
      x: Math.min(this.selectionStart.x, svgPt.x),
      y: Math.min(this.selectionStart.y, svgPt.y),
      w: Math.abs(svgPt.x - this.selectionStart.x),
      h: Math.abs(svgPt.y - this.selectionStart.y)
    };
  }

  endSelectionBox() {
    if (!this.isSelectionBoxActive) return;
    this.isSelectionBoxActive = false;
    const box = this.selectionBox;
    this.selectedNodes = this.nodes.filter(n => {
      const nw = n.width || 160;
      const nh = n.height || 80;
      return n.x >= box.x && n.y >= box.y &&
             (n.x + nw) <= (box.x + box.w) &&
             (n.y + nh) <= (box.y + box.h);
    });
    if (this.selectedNodes.length > 0) {
      this.message.info(`${this.selectedNodes.length} elemento(s) seleccionado(s)`);
    }
  }

  // ===== CLIPBOARD (Plan §3: Copiar/Cortar/Pegar) =====

  copySelection() {
    const nodesToCopy = this.selectedNodes.length > 0 ? this.selectedNodes : (this.selectedNode ? [this.selectedNode] : []);
    if (nodesToCopy.length === 0) return;
    const nodeIds = new Set(nodesToCopy.map(n => n.id));
    const edgesToCopy = this.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    this.clipboard = {
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      edges: JSON.parse(JSON.stringify(edgesToCopy))
    };
    this.message.success(`${nodesToCopy.length} elemento(s) copiado(s)`);
  }

  cutSelection() {
    this.copySelection();
    if (this.clipboard) {
      const ids = new Set(this.clipboard.nodes.map(n => n.id));
      this.nodes = this.nodes.filter(n => !ids.has(n.id));
      this.edges = this.edges.filter(e => !ids.has(e.source) && !ids.has(e.target));
      this.selectedNodes = [];
      this.selectedNode = null;
      this.broadcastUpdate();
    }
  }

  pasteClipboard() {
    if (!this.clipboard) return;
    const idMap = new Map<string, string>();
    const offset = 30;
    const newNodes: NodeData[] = this.clipboard.nodes.map(n => {
      const newId = `${n.type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(n.id, newId);
      return { ...n, id: newId, x: n.x + offset, y: n.y + offset };
    });
    const newEdges: EdgeData[] = this.clipboard.edges.map(e => ({
      ...e,
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target
    }));
    this.nodes.push(...newNodes);
    this.edges.push(...newEdges);
    this.selectedNodes = newNodes;
    this.broadcastUpdate();
    this.message.success(`${newNodes.length} elemento(s) pegado(s)`);
  }

  // ===== FIND & ZOOM (Plan §3: Navegación Visual) =====

  toggleSearch() {
    this.showSearchPanel = !this.showSearchPanel;
    this.searchResults = [];
    this.searchQuery = '';
  }

  searchNodes() {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.searchResults = this.nodes.filter(n =>
      (n.label || '').toLowerCase().includes(q) ||
      (n.type || '').toLowerCase().includes(q)
    );
  }

  focusOnNode(node: NodeData) {
    this.selectedNode = node;
    // Center viewport on the node
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    const nw = node.width || 160;
    const nh = node.height || 80;
    const cx = node.x + nw / 2;
    const cy = node.y + nh / 2;
    // Animate viewBox to center on node
    this.viewBoxX = cx - this.viewBoxW / 2;
    this.viewBoxY = cy - this.viewBoxH / 2;
    svg.setAttribute('viewBox', `${this.viewBoxX} ${this.viewBoxY} ${this.viewBoxW} ${this.viewBoxH}`);
    this.message.info(`Centrado en: ${node.label}`);
  }

  // ===== ZOOM & PAN (Plan §3) =====

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent) {
    if (!this.svgElement) return;
    event.preventDefault();
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    
    // Convert mouse position to SVG coordinates BEFORE zoom
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const cursorSvg = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    
    const newW = this.viewBoxW * zoomFactor;
    const newH = this.viewBoxH * zoomFactor;
    
    // Adjust viewBox origin so the SVG point under the cursor stays fixed
    this.viewBoxX = cursorSvg.x - (cursorSvg.x - this.viewBoxX) * zoomFactor;
    this.viewBoxY = cursorSvg.y - (cursorSvg.y - this.viewBoxY) * zoomFactor;
    this.viewBoxW = newW;
    this.viewBoxH = newH;
    
    this.zoomLevel = 3000 / this.viewBoxW;
    svg.setAttribute('viewBox', `${this.viewBoxX} ${this.viewBoxY} ${this.viewBoxW} ${this.viewBoxH}`);
  }

  zoomIn() {
    this.viewBoxW *= 0.8;
    this.viewBoxH *= 0.8;
    this.zoomLevel = 3000 / this.viewBoxW;
    this.applyViewBox();
  }

  zoomOut() {
    this.viewBoxW *= 1.25;
    this.viewBoxH *= 1.25;
    this.zoomLevel = 3000 / this.viewBoxW;
    this.applyViewBox();
  }

  zoomFit() {
    if (this.nodes.length === 0) {
      this.viewBoxX = 0;
      this.viewBoxY = 0;
      this.viewBoxW = 3000;
      this.viewBoxH = 2000;
      this.zoomLevel = 1;
      this.applyViewBox();
      return;
    }
    const margin = 100;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    this.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + (n.width || 160));
      maxY = Math.max(maxY, n.y + (n.height || 80));
    });
    
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;
    
    this.viewBoxX = minX;
    this.viewBoxY = minY;
    this.viewBoxW = maxX - minX;
    this.viewBoxH = maxY - minY;
    
    this.zoomLevel = 3000 / this.viewBoxW;
    this.applyViewBox();
  }

  private applyViewBox() {
    if (!this.svgElement) return;
    const svg: SVGSVGElement = this.svgElement.nativeElement;
    svg.setAttribute('viewBox', `${this.viewBoxX} ${this.viewBoxY} ${this.viewBoxW} ${this.viewBoxH}`);
  }



  // ===== BOTTLENECK DETECTION (Plan §4: Auditoría Analítica) =====

  detectBottlenecks() {
    this.bottleneckNodeIds = [];
    const deadEnds: string[] = [];
    const orphans: string[] = [];

    for (const node of this.nodes) {
      if (node.type === 'swimlane') continue;

      const hasOutgoing = this.edges.some(e => e.source === node.id);
      const hasIncoming = this.edges.some(e => e.target === node.id);

      // Dead-end: non-terminal node with no outgoing edges
      if (!hasOutgoing && !['end', 'activity_final', 'flow_final'].includes(node.type)) {
        deadEnds.push(node.id);
      }

      // Orphan: no incoming AND no outgoing (except start nodes)
      if (!hasIncoming && !hasOutgoing && node.type !== 'start') {
        orphans.push(node.id);
      }

      // Bottleneck: activity that receives from multiple sources (fan-in > 2)
      if (node.type === 'activity') {
        const incomingCount = this.edges.filter(e => e.target === node.id).length;
        if (incomingCount > 2) {
          this.bottleneckNodeIds.push(node.id);
        }
      }

      // Decision without labels on outgoing edges
      if (node.type === 'decision') {
        const outEdges = this.edges.filter(e => e.source === node.id);
        const unlabeled = outEdges.filter(e => !e.label || e.label.trim() === '');
        if (unlabeled.length > 0) {
          this.bottleneckNodeIds.push(node.id);
        }
      }
    }

    this.bottleneckNodeIds.push(...deadEnds, ...orphans);
    const total = this.bottleneckNodeIds.length;
    if (total > 0) {
      this.message.warning(`Se detectaron ${total} posible(s) problema(s): ${deadEnds.length} caminos sin salida, ${orphans.length} nodos huérfanos`);
      
      const firstErrorNode = this.nodes.find(n => n.id === this.bottleneckNodeIds[0]);
      if (firstErrorNode) {
        // Mover la cámara (viewBox) hacia el componente con error
        const centerX = (firstErrorNode.x || 0) + (firstErrorNode.width || 120) / 2;
        const centerY = (firstErrorNode.y || 0) + (firstErrorNode.height || 80) / 2;
        this.viewBoxX = centerX - (this.viewBoxW / 2);
        this.viewBoxY = centerY - (this.viewBoxH / 2);
        this.applyViewBox();
      }

      // Auto-clear highlight after 2 minutes (120000 ms)
      setTimeout(() => { this.bottleneckNodeIds = []; }, 120000);
    } else {
      this.message.success('No se detectaron cuellos de botella ni errores lógicos.');
    }
  }

  // ===== TEMPLATES (Plan §3: Plantillas) =====

  insertTemplate(templateName: string) {
    const templates: Record<string, { nodes: Partial<NodeData>[], edges: Partial<EdgeData>[] }> = {
      'aprobacion': {
        nodes: [
          { type: 'start', label: 'Inicio', x: 80, y: 80, width: 40, height: 40 },
          { type: 'activity', label: 'Enviar Solicitud', x: 50, y: 180, width: 160, height: 80 },
          { type: 'decision', label: '¿Aprobado?', x: 50, y: 320, width: 120, height: 100 },
          { type: 'activity', label: 'Procesar Aprobación', x: 50, y: 490, width: 160, height: 80 },
          { type: 'activity', label: 'Notificar Rechazo', x: 250, y: 320, width: 160, height: 80 },
          { type: 'end', label: 'Fin', x: 110, y: 630, width: 40, height: 40 }
        ],
        edges: [
          { source: 'Inicio', target: 'Enviar Solicitud' },
          { source: 'Enviar Solicitud', target: '¿Aprobado?' },
          { source: '¿Aprobado?', target: 'Procesar Aprobación', label: '[Sí]' },
          { source: '¿Aprobado?', target: 'Notificar Rechazo', label: '[No]' },
          { source: 'Procesar Aprobación', target: 'Fin' },
          { source: 'Notificar Rechazo', target: 'Fin' }
        ]
      },
      'pasarela_pago': {
        nodes: [
          { type: 'start', label: 'Inicio Pago', x: 80, y: 50, width: 40, height: 40 },
          { type: 'activity', label: 'Seleccionar Método', x: 40, y: 140, width: 160, height: 80 },
          { type: 'decision', label: '¿Válido?', x: 50, y: 280, width: 120, height: 100 },
          { type: 'activity', label: 'Procesar Cobro', x: 40, y: 440, width: 160, height: 80 },
          { type: 'activity', label: 'Mostrar Error', x: 260, y: 280, width: 160, height: 80 },
          { type: 'end', label: 'Fin Pago', x: 100, y: 580, width: 40, height: 40 }
        ],
        edges: [
          { source: 'Inicio Pago', target: 'Seleccionar Método' },
          { source: 'Seleccionar Método', target: '¿Válido?' },
          { source: '¿Válido?', target: 'Procesar Cobro', label: '[Sí]' },
          { source: '¿Válido?', target: 'Mostrar Error', label: '[No]' },
          { source: 'Procesar Cobro', target: 'Fin Pago' },
          { source: 'Mostrar Error', target: 'Seleccionar Método' }
        ]
      }
    };

    const tpl = templates[templateName];
    if (!tpl) {
      this.message.warning('Plantilla no encontrada');
      return;
    }

    // Create nodes with unique IDs
    const idMap = new Map<string, string>();
    const offset = this.nodes.length > 0 ? Math.max(...this.nodes.map(n => n.x + (n.width || 160))) + 50 : 0;

    for (const tplNode of tpl.nodes) {
      const id = `${tplNode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(tplNode.label!, id);
      this.nodes.push({
        id,
        type: tplNode.type!,
        label: tplNode.label!,
        x: (tplNode.x || 0) + offset,
        y: tplNode.y || 0,
        width: tplNode.width || 160,
        height: tplNode.height || 80,
        fontSize: 12
      });
    }

    for (const tplEdge of tpl.edges) {
      const srcId = idMap.get(tplEdge.source as string);
      const tgtId = idMap.get(tplEdge.target as string);
      if (srcId && tgtId) {
        this.edges.push({
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          source: srcId,
          target: tgtId,
          label: tplEdge.label,
          style: 'solid',
          color: '#455a64',
          strokeWidth: 2,
          opacity: 100,
          waypoints: []
        });
      }
    }

    this.checkAndExpandLanes();
    this.broadcastUpdate();
    this.message.success(`Plantilla "${templateName}" insertada correctamente`);
  }

  // ===== TRACKING (Performance & Socket Sync) =====
  trackById(index: number, item: any): string {
    return item.id || (item.key ? item.key : index.toString());
  }
}

