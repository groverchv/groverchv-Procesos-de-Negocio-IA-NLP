import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzMessageService } from 'ng-zorro-antd/message';
import { DesignService } from '../../../services/design.service';
import { Design, Modeling, NodeData, EdgeData } from '../../../services/types';

@Component({
  selector: 'app-design-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, NzCardModule, NzGridModule, NzTypographyModule,
    NzIconModule, NzButtonModule, NzSpaceModule, NzBreadCrumbModule, NzTagModule, NzModalModule, NzRadioModule
  ],
  templateUrl: './design-list.html',
  styles: [`
    /* ── Container ── */
    .dl-container {
      padding: 40px;
      background: #f8fafc;
      min-height: calc(100vh - 72px);
    }
    .dl-breadcrumb { margin-bottom: 24px; }

    /* ── Header ── */
    .dl-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }
    .dl-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .dl-back-btn {
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 12px;
      background: white;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .dl-back-btn:hover { background: #f1f5f9; transform: translateX(-2px); }
    .dl-title { margin: 0; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .dl-subtitle { margin: 4px 0 0; font-size: 14px; color: #64748b; }
    .dl-new-btn { height: 48px; border-radius: 12px; font-weight: 700; padding: 0 24px; font-size: 14px; }

    /* ── Empty ── */
    .dl-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 100px 20px;
      text-align: center;
    }
    .dl-empty-icon { margin-bottom: 20px; }
    .dl-empty-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }
    .dl-empty-desc { color: #64748b; margin: 0 0 24px; }
    .dl-empty-btn { height: 44px; border-radius: 10px; font-weight: 600; }

    /* ── Grid ── */
    .dl-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    /* ── Card ── */
    .dl-card {
      background: white;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px -2px rgba(0,0,0,0.04);
    }
    .dl-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 40px -8px rgba(79, 70, 229, 0.18);
      border-color: #c7d2fe;
    }

    /* ── Card Thumbnail ── */
    .dl-card-thumb {
      height: 200px;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
      position: relative;
      border-bottom: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .dl-card-thumb-inner {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
    }
    .dl-mini-svg {
      width: 100%; height: 100%;
      padding: 12px;
    }
    .dl-thumb-placeholder {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      opacity: 0.7;
    }
    .dl-thumb-label { font-size: 12px; color: #94a3b8; font-weight: 600; }
    .dl-delete-btn {
      position: absolute; top: 10px; right: 10px; z-index: 10;
      opacity: 0; transform: scale(0.8);
      transition: all 0.25s ease;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
    }
    .dl-card:hover .dl-delete-btn { opacity: 1; transform: scale(1); }
    .dl-status-badge {
      position: absolute; bottom: 10px; left: 10px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 700;
    }
    .dl-status-draft { background: #e0e7ff; color: #4f46e5; }
    .dl-status-active { background: #dcfce7; color: #16a34a; }

    /* ── Card Body ── */
    .dl-card-body { padding: 18px 20px 16px; }
    .dl-card-name { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dl-card-meta { display: flex; gap: 12px; margin-bottom: 14px; }
    .dl-meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; }
    .dl-card-actions { display: flex; gap: 4px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
    .dl-view-btn { color: #4f46e5 !important; font-size: 13px !important; font-weight: 600 !important; }
    .dl-edit-btn { color: #64748b !important; font-size: 13px !important; font-weight: 600 !important; }

    /* ── BPMN Preview Modal ── */
    :host ::ng-deep .bpmn-preview-modal .ant-modal-content { border-radius: 20px; overflow: hidden; }
    :host ::ng-deep .bpmn-preview-modal .ant-modal-header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px 24px; border-bottom: none; }
    :host ::ng-deep .bpmn-preview-modal .ant-modal-title { color: white; }
    :host ::ng-deep .bpmn-preview-modal .ant-modal-close { color: white; }
    :host ::ng-deep .bpmn-preview-modal .ant-modal-footer { border-top: 1px solid #e2e8f0; padding: 16px 24px; }

    .modal-title-row { display: flex; align-items: center; gap: 14px; }
    .modal-title-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .modal-title-name { font-size: 17px; font-weight: 700; color: white; }
    .modal-title-sub { font-size: 13px; color: rgba(255,255,255,0.75); }

    .bpmn-modal-content { padding: 0; min-height: 480px; }

    .bpmn-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px;
      color: #64748b;
    }
    .bpmn-loading-spinner {
      width: 40px; height: 40px;
      border: 3px solid #e0e7ff;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .bpmn-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px; text-align: center; color: #64748b;
    }
    .bpmn-empty h4 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }

    /* ── Canvas ── */
    .bpmn-canvas-wrap { display: flex; flex-direction: column; height: 580px; }

    .bpmn-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .bpmn-legend { display: flex; gap: 16px; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 500; }
    .legend-dot {
      width: 12px; height: 12px; border-radius: 50%;
    }
    .legend-dot.start { background: #dcfce7; border: 2px solid #16a34a; }
    .legend-dot.end { background: #fee2e2; border: 2px solid #dc2626; }
    .legend-dot.task { background: white; border: 2px solid #4f46e5; border-radius: 3px; }
    .legend-dot.gateway { background: #faf5ff; border: 2px solid #7c3aed; transform: rotate(45deg); border-radius: 2px; }

    .bpmn-zoom-controls { display: flex; align-items: center; gap: 6px; }
    .zoom-btn {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      color: #475569;
      transition: all 0.15s ease;
    }
    .zoom-btn:hover { background: #f1f5f9; color: #1e293b; }
    .zoom-label { font-size: 13px; font-weight: 600; color: #475569; min-width: 44px; text-align: center; }

    .bpmn-canvas {
      flex: 1;
      overflow: auto;
      background: #fafbfc;
      background-image: radial-gradient(circle, #c7d2fe 1px, transparent 1px);
      background-size: 24px 24px;
      position: relative;
      cursor: grab;
    }
    .bpmn-canvas:active { cursor: grabbing; }
    .bpmn-svg { display: block; }

    /* ── Foreign object content ── */
    .node-label-text {
      font-size: 12px; font-weight: 600; color: #1e293b;
      word-break: break-word; line-height: 1.4;
      display: flex; align-items: center; height: 100%;
      font-family: 'Inter', sans-serif;
    }
    .note-text {
      font-size: 11px; color: #713f12; line-height: 1.4;
      overflow: hidden; height: 100%;
      font-family: 'Inter', sans-serif;
    }
    .edge-label-badge {
      font-size: 11px; font-weight: 600; color: #475569;
      background: white; border: 1px solid #e2e8f0;
      border-radius: 4px; padding: 2px 6px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: 'Inter', sans-serif;
    }

    /* ── Modal Footer ── */
    .modal-footer-row { display: flex; justify-content: space-between; align-items: center; }
    .modal-footer-info { font-size: 13px; color: #64748b; display: flex; gap: 8px; align-items: center; }
    .footer-sep { color: #cbd5e1; }
  `]
})
export class DesignListComponent implements OnInit {
  @ViewChild('bpmnCanvas') bpmnCanvasRef!: ElementRef;

  projectId: string | null = null;
  designs: Design[] = [];
  loading = true;
  isVisible = false;
  isConfirmLoading = false;
  isReadOnly = false;

  newDesign: Design = {
    nombre: '',
    projectId: '',
    estado: 'Borrador',
    layoutType: 'vertical'
  };

  // Preview modal state
  isPreviewModalVisible = false;
  selectedDesignName = '';
  selectedDesignId = '';
  cargandoPreview = false;
  previewModeling: Modeling | null = null;

  // Zoom & pan
  previewZoom = 1;
  panX = 0;
  panY = 0;
  private isPanning = false;
  private panStart = { x: 0, y: 0 };

  // Thumbnails (keyed by design id)
  designPreviews: Record<string, Modeling> = {};

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private designService: DesignService,
    private message: NzMessageService
  ) {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
  }

  ngOnInit(): void {
    this.isReadOnly = this.router.url.includes('/staff');
    if (this.projectId) {
      this.loadDesigns();
      this.newDesign.projectId = this.projectId;
    }
  }

  loadDesigns() {
    this.loading = true;
    this.designService.getDesignsByProject(this.projectId!).subscribe({
      next: (data: Design[]) => {
        this.designs = data;
        this.loading = false;
        // Load thumbnails for each design
        data.forEach(d => {
          if (d.id) this.loadThumbnail(d.id);
        });
      },
      error: () => {
        this.message.error('Error al cargar diseños');
        this.loading = false;
      }
    });
  }

  loadThumbnail(designId: string) {
    this.designService.getModelingByDesignId(designId).subscribe({
      next: (modeling) => {
        this.designPreviews[designId] = modeling;
      },
      error: () => {
        this.designPreviews[designId] = { nodes: [], edges: [] };
      }
    });
  }

  showModal(): void { this.isVisible = true; }
  handleCancel(): void { this.isVisible = false; }

  handleOk(): void {
    if (!this.newDesign.nombre) {
      this.message.warning('El nombre es obligatorio');
      return;
    }
    this.isConfirmLoading = true;
    this.designService.createDesign(this.newDesign).subscribe({
      next: () => {
        this.message.success('Diseño creado correctamente');
        this.isVisible = false;
        this.isConfirmLoading = false;
        this.newDesign = { nombre: '', projectId: this.projectId || '', estado: 'Borrador', layoutType: 'vertical' };
        this.loadDesigns();
      },
      error: () => {
        this.message.error('Error al crear el diseño');
        this.isConfirmLoading = false;
      }
    });
  }

  deleteDesign(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.designService.deleteDesign(id).subscribe({
      next: () => {
        this.message.success('Diseño eliminado');
        this.loadDesigns();
      },
      error: () => this.message.error('Error al eliminar el diseño')
    });
  }

  openModeler(id: string) {
    const parent = this.isReadOnly ? 'staff' : 'designer';
    this.router.navigate([`/${parent}/designs`, id]);
  }

  openModelerFromPreview() {
    if (this.selectedDesignId) {
      this.cerrarPreviewModal();
      this.openModeler(this.selectedDesignId);
    }
  }

  visualizarDiseno(event: MouseEvent, design: Design) {
    event.stopPropagation();
    this.selectedDesignName = design.nombre;
    this.selectedDesignId = design.id!;
    this.isPreviewModalVisible = true;
    this.previewZoom = 1;
    this.panX = 0;
    this.panY = 0;

    // Use cached thumbnail first for instant display
    if (this.designPreviews[design.id!]) {
      this.previewModeling = this.designPreviews[design.id!];
      this.cargandoPreview = false;
    } else {
      this.cargandoPreview = true;
      this.previewModeling = null;
    }

    // Always refresh from server
    this.designService.getModelingByDesignId(design.id!).subscribe({
      next: (modeling) => {
        this.previewModeling = modeling;
        this.designPreviews[design.id!] = modeling;
        this.cargandoPreview = false;
        // Auto-fit
        setTimeout(() => this.zoomReset(), 50);
      },
      error: () => {
        this.message.error('Error al cargar la estructura del flujo');
        this.cargandoPreview = false;
        if (!this.previewModeling) this.isPreviewModalVisible = false;
      }
    });
  }

  cerrarPreviewModal() {
    this.isPreviewModalVisible = false;
    this.previewModeling = null;
  }

  // ──────────────────────────────
  // ZOOM & PAN
  // ──────────────────────────────
  zoomIn() { this.previewZoom = Math.min(3, this.previewZoom + 0.15); }
  zoomOut() { this.previewZoom = Math.max(0.2, this.previewZoom - 0.15); }
  zoomReset() {
    this.previewZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  onCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.previewZoom = Math.min(3, Math.max(0.2, this.previewZoom + delta));
  }

  startPan(event: MouseEvent) {
    if (event.button !== 0) return;
    this.isPanning = true;
    this.panStart = { x: event.clientX - this.panX, y: event.clientY - this.panY };
  }

  doPan(event: MouseEvent) {
    if (!this.isPanning) return;
    this.panX = event.clientX - this.panStart.x;
    this.panY = event.clientY - this.panStart.y;
  }

  endPan() { this.isPanning = false; }

  // ──────────────────────────────
  // PREVIEW HELPERS
  // ──────────────────────────────
  hasPreviewNodes(designId: string): boolean {
    const m = this.designPreviews[designId];
    return !!m && m.nodes && m.nodes.length > 0;
  }

  getPreviewNodeCount(designId: string): number {
    const m = this.designPreviews[designId];
    return m?.nodes?.length || 0;
  }

  getPreviewNodes(designId: string): NodeData[] {
    const m = this.designPreviews[designId];
    return m?.nodes || [];
  }

  getPreviewEdges(designId: string): EdgeData[] {
    const m = this.designPreviews[designId];
    return m?.edges || [];
  }

  // ──────────────────────────────
  // NODE TYPE HELPERS
  // ──────────────────────────────
  readonly SPECIAL_TYPES = new Set([
    'start','end','activity_final','flow_final','decision','parallel','merge',
    'fork','join','signal_send','signal_receive','note','swimlane'
  ]);

  isSpecialType(type: string): boolean {
    return this.SPECIAL_TYPES.has(type);
  }

  isActivityType(type: string): boolean {
    return !this.SPECIAL_TYPES.has(type);
  }

  getSwimlanes(): NodeData[] {
    return this.previewModeling?.nodes.filter(n => n.type === 'swimlane') || [];
  }

  getNonSwimlanes(): NodeData[] {
    return this.previewModeling?.nodes.filter(n => n.type !== 'swimlane') || [];
  }

  truncate(text: string, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // ──────────────────────────────
  // DIAMOND / SPECIAL SHAPE HELPERS
  // ──────────────────────────────
  getDiamondPoints(node: NodeData): string {
    const w = node.width || 120;
    const h = node.height || 100;
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;
    return `${cx},${node.y} ${node.x + w},${cy} ${cx},${node.y + h} ${node.x},${cy}`;
  }

  getFullDiamondPoints(node: NodeData): string {
    return this.getDiamondPoints(node);
  }

  getSignalPoints(node: NodeData): string {
    const w = node.width || 160;
    const h = node.height || 60;
    return `${node.x},${node.y} ${node.x + w},${node.y} ${node.x + w},${node.y + h} ${node.x},${node.y + h}`;
  }

  getNoteFoldPoints(node: NodeData): string {
    const foldSize = 14;
    const w = node.width || 140;
    const x = node.x;
    const y = node.y;
    return `${x + w - foldSize},${y} ${x + w},${y + foldSize} ${x + w - foldSize},${y + foldSize}`;
  }

  // ──────────────────────────────
  // EDGE ROUTING (shared logic)
  // ──────────────────────────────
  private getNodeById(id: string, nodes: NodeData[]): NodeData | undefined {
    return nodes.find(n => n.id === id);
  }

  private calcPort(node: NodeData, targetNode: NodeData): { out: {x:number,y:number}, inp: {x:number,y:number} } {
    const w = node.width || 120;
    const h = node.height || 80;
    const tw = targetNode.width || 120;
    const th = targetNode.height || 80;

    const cx = node.x + w/2, cy = node.y + h/2;
    const tcx = targetNode.x + tw/2, tcy = targetNode.y + th/2;
    const dx = tcx - cx, dy = tcy - cy;

    let outPt: {x:number,y:number}, inPt: {x:number,y:number};
    if (Math.abs(dx) > Math.abs(dy)) {
      outPt = dx > 0 ? {x: node.x + w, y: cy} : {x: node.x, y: cy};
      inPt = dx > 0 ? {x: targetNode.x, y: tcy} : {x: targetNode.x + tw, y: tcy};
    } else {
      outPt = dy > 0 ? {x: cx, y: node.y + h} : {x: cx, y: node.y};
      inPt = dy > 0 ? {x: tcx, y: targetNode.y} : {x: tcx, y: targetNode.y + th};
    }
    return { out: outPt, inp: inPt };
  }

  private buildPath(out: {x:number,y:number}, inp: {x:number,y:number}, waypoints: {x:number,y:number}[] = []): string {
    const pts: {x:number,y:number}[] = [out, ...waypoints, inp];
    let path = `M ${pts[0].x} ${pts[0].y}`;
    const r = 8;
    for (let i = 1; i < pts.length - 1; i++) {
      const p1 = pts[i-1], p2 = pts[i], p3 = pts[i+1];
      const d1 = {x: p1.x - p2.x, y: p1.y - p2.y};
      const d2 = {x: p3.x - p2.x, y: p3.y - p2.y};
      const len1 = Math.hypot(d1.x, d1.y), len2 = Math.hypot(d2.x, d2.y);
      const rr = Math.min(r, len1/2, len2/2);
      const r1 = len1 > 0 ? rr/len1 : 0, r2 = len2 > 0 ? rr/len2 : 0;
      const s = {x: p2.x + d1.x * r1, y: p2.y + d1.y * r1};
      const e = {x: p2.x + d2.x * r2, y: p2.y + d2.y * r2};
      path += ` L ${s.x} ${s.y} Q ${p2.x} ${p2.y} ${e.x} ${e.y}`;
    }
    path += ` L ${pts[pts.length-1].x} ${pts[pts.length-1].y}`;
    return path;
  }

  // Full preview edge path
  getFullEdgePath(edge: EdgeData): string {
    if (!this.previewModeling) return '';
    const src = this.getNodeById(edge.source, this.previewModeling.nodes);
    const tgt = this.getNodeById(edge.target, this.previewModeling.nodes);
    if (!src || !tgt) return '';
    const { out, inp } = this.calcPort(src, tgt);
    return this.buildPath(out, inp, edge.waypoints || []);
  }

  getFullEdgeLabelX(edge: EdgeData): number {
    if (!this.previewModeling) return 0;
    const src = this.getNodeById(edge.source, this.previewModeling.nodes);
    const tgt = this.getNodeById(edge.target, this.previewModeling.nodes);
    if (!src || !tgt) return 0;
    const { out, inp } = this.calcPort(src, tgt);
    if (edge.waypoints?.length) return edge.waypoints[Math.floor(edge.waypoints.length/2)].x;
    return (out.x + inp.x) / 2;
  }

  getFullEdgeLabelY(edge: EdgeData): number {
    if (!this.previewModeling) return 0;
    const src = this.getNodeById(edge.source, this.previewModeling.nodes);
    const tgt = this.getNodeById(edge.target, this.previewModeling.nodes);
    if (!src || !tgt) return 0;
    const { out, inp } = this.calcPort(src, tgt);
    if (edge.waypoints?.length) return edge.waypoints[Math.floor(edge.waypoints.length/2)].y;
    return (out.y + inp.y) / 2;
  }

  // Mini-thumbnail edge path
  getMiniEdgePath(designId: string, edge: EdgeData): string {
    const modeling = this.designPreviews[designId];
    if (!modeling) return '';
    const src = this.getNodeById(edge.source, modeling.nodes);
    const tgt = this.getNodeById(edge.target, modeling.nodes);
    if (!src || !tgt) return '';
    const { out, inp } = this.calcPort(src, tgt);
    return this.buildPath(out, inp, []);
  }

  // ──────────────────────────────
  // SVG DIMENSIONS
  // ──────────────────────────────
  getFullSvgDimensions(): {width: number, height: number} {
    if (!this.previewModeling || this.previewModeling.nodes.length === 0) {
      return { width: 900, height: 540 };
    }
    let maxX = 900, maxY = 540;
    for (const node of this.previewModeling.nodes) {
      const x = node.x + (node.width || 160) + 60;
      const y = node.y + (node.height || 80) + 60;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { width: maxX, height: maxY };
  }

  getMiniViewBox(designId: string): string {
    const modeling = this.designPreviews[designId];
    if (!modeling || modeling.nodes.length === 0) return '0 0 300 200';
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    for (const node of modeling.nodes) {
      const nx = node.x, ny = node.y;
      const nxe = node.x + (node.width || 120);
      const nye = node.y + (node.height || 80);
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nxe > maxX) maxX = nxe;
      if (nye > maxY) maxY = nye;
    }
    const pad = 20;
    const w = Math.max(maxX - minX + pad*2, 100);
    const h = Math.max(maxY - minY + pad*2, 100);
    return `${minX - pad} ${minY - pad} ${w} ${h}`;
  }
}
