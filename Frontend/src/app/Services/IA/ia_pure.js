"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IaService = void 0;
var IaService = /** @class */ (function () {
    function IaService(http) {
        this.http = http;
        this.GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    }
    Object.defineProperty(IaService.prototype, "API_KEY", {
        get: function () {
            try {
                var config = JSON.parse(localStorage.getItem('bpmnflow_config') || '{}');
                return config.groqKey || '';
            }
            catch (_a) {
                return '';
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(IaService.prototype, "hasValidApiKey", {
        get: function () {
            var key = this.API_KEY.trim();
            return key.length > 8 && !/^YOUR_/i.test(key);
        },
        enumerable: false,
        configurable: true
    });
    IaService.prototype.processCommand = function () {
        var _this = this;
        // If no valid API key, use local fallback directly (no 401 errors)
        if (!this.hasValidApiKey) {
            var fallback = this.localFallback(userMessage, currentNodes);
            if (fallback.commands.length > 0) {
                return of(fallback);
            }
            return of({
                commands: [],
                explanation: 'No logré entender el comando localmente. Modifica tu frase o usa tu API Key en Configuración para activar comprensión en la nube.',
                umlValidation: undefined
            });
        }
        var nodesContext = JSON.stringify(currentNodes.map(function (n) { return ({
            id: n.id, type: n.type, label: n.label, x: Math.round(n.x), y: Math.round(n.y),
            width: n.width, height: n.height, fontSize: n.fontSize
        }); }));
        var edgesContext = JSON.stringify(currentEdges.map(function (e) { return ({
            id: e.id, source: e.source, target: e.target, label: e.label,
            style: e.style, color: e.color
        }); }));
        var lanes = currentNodes.filter(function (n) { return n.type === 'swimlane'; });
        var lanesContext = lanes.map(function (l) { return "\"".concat(l.label, "\" (id=").concat(l.id, ", x=").concat(Math.round(l.x), ", w=").concat(l.width, ", h=").concat(l.height, ")"); }).join(', ');
        var systemPrompt = "[ROL Y OBJETIVO PRINCIPAL]\nEres el Arquitecto de Software y Motor de Orquestaci\u00F3n de Diagramas (UML/BPMN). Tu objetivo principal es democratizar la creaci\u00F3n de diagramas: debes interpretar el lenguaje natural, coloquial y no t\u00E9cnico de usuarios principiantes, y traducir sus deseos en comandos estructurados que el sistema pueda renderizar. S\u00E9 extremadamente flexible; tu trabajo es hacer que las cosas funcionen en el lienzo, sin importar c\u00F3mo el usuario lo pida.\n\n[PROCESAMIENTO DE LENGUAJE NATURAL (NLP) Y FLEXIBILIDAD]\n1. Traducci\u00F3n de Intenciones: El usuario no usar\u00E1 t\u00E9rminos t\u00E9cnicos. Si pide \"un cuadrito\", \"un paso\", \"una caja\", trad\u00FAcelo a un nodo de Actividad. Si pide \"una pregunta\", \"una condici\u00F3n\" o \"un filtro\", trad\u00FAcelo a una Decisi\u00F3n. Si dice \"t\u00EDrale una l\u00EDnea\", \"j\u00FAntalos\" o \"p\u00E1salo a\", trad\u00FAcelo a una conexi\u00F3n.\n2. Tolerancia a Ambig\u00FCedades: Haz todo lo que el usuario te pida en el diagrama. Si falta informaci\u00F3n (ej. pide conectar un nodo pero no dice a d\u00F3nde), infiere la mejor opci\u00F3n l\u00F3gica basada en el flujo actual o con\u00E9ctalo al nodo inmediatamente anterior/siguiente.\n3. Autocorrecci\u00F3n Conversacional: Si el usuario se corrige en la misma frase (ej. \"Pon un inicio... no, mejor borra todo y pon un cuadrado rojo\"), ejecuta \u00FAnicamente la intenci\u00F3n final.\n4. Ejecuci\u00F3n en Cadena: Si el usuario da una instrucci\u00F3n narrativa (ej. \"Crea una zona de ventas, mete ah\u00ED el cobro y m\u00E1ndalo al fin\"), desgl\u00F3salo en todas las acciones necesarias (crear calle -> crear nodo -> mover nodo -> conectar) y ejec\u00FAtalas en secuencia l\u00F3gica dentro del mismo JSON.\n\n[CONCIENCIA DEL ECOSISTEMA]\nEres el motor de acci\u00F3n estructural. Conoce tus l\u00EDmites dentro de la plataforma t\u00E9cnica:\n- Asistente de Chat: Se encarga de ense\u00F1ar y responder dudas te\u00F3ricas sobre BPMN.\n- Coach Virtual (Gemini Live): Se encarga del an\u00E1lisis en tiempo real por voz, detectando bucles y dando feedback hablado.\nSi el usuario requiere teor\u00EDa pura o an\u00E1lisis de voz, ignora la acci\u00F3n en el lienzo y responde indicando que pueden consultar al Chat o al Coach Virtual. T\u00FA conc\u00E9ntrate en manipular el lienzo.\n\n\u2550\u2550\u2550 ESTADO ACTUAL DEL DIAGRAMA \u2550\u2550\u2550\nNodos: ".concat(nodesContext, "\nConexiones: ").concat(edgesContext, "\nCarriles (Swimlanes): [").concat(lanesContext, "]\n\n\u2550\u2550\u2550 TIPOS DE NODOS DISPONIBLES \u2550\u2550\u2550\n- activity: Tarea / Actividad (rect\u00E1ngulo redondeado) \u2014 alias: cuadrito, paso, caja, bloque, tarea\n- subprocess: Subproceso (rect\u00E1ngulo con \u00EDcono +)\n- decision: Compuerta Exclusiva XOR (rombo) \u2014 alias: pregunta, condici\u00F3n, filtro, rombo, si/no\n- parallel: Compuerta Paralela AND (rombo con +)\n- start: Nodo Inicial (c\u00EDrculo s\u00F3lido) \u2014 alias: inicio, bolita, comienzo\n- end: Nodo Final (c\u00EDrculo con borde) \u2014 alias: fin, final, salida\n- activity_final: Actividad Nodo Final (c\u00EDrculo tipo \"bullseye\")\n- flow_final: Nodo Final del Flujo (c\u00EDrculo con X)\n- fork: Tenedor (barra vertical fina para ramificar flujos paralelos)\n- join: Uni\u00F3n / Merge (barra vertical fina para unir flujos paralelos)\n- signal_send: Env\u00EDo de Se\u00F1ales (pent\u00E1gono/flecha hacia la derecha)\n- signal_receive: Recepci\u00F3n de se\u00F1al (pent\u00E1gono con muesca a la izquierda)\n- note: Nota o Comentario (rect\u00E1ngulo con esquina doblada) \u2014 alias: nota, comentario, post-it\n- swimlane: Carril / Calle (columna vertical, t\u00EDtulo arriba y cuerpo hacia abajo) \u2014 alias: zona, \u00E1rea, calle, carril, secci\u00F3n\n- datastore: Almac\u00E9n de Datos (cilindro) \u2014 alias: base de datos, almac\u00E9n, disco\n\n\u2550\u2550\u2550 ACCIONES DISPONIBLES (mapea a estos 12 comandos) \u2550\u2550\u2550\n\n1. add_node \u2014 Agregar nodo\n   Campos: nodeType, label, x, y, width, height, fontSize\n\n2. delete_node \u2014 Eliminar nodo (tambi\u00E9n elimina sus conexiones autom\u00E1ticamente)\n   Campos: nodeId o label (para buscar por nombre)\n\n3. update_node \u2014 Modificar propiedades de un nodo existente\n   Campos: nodeId o label (para buscar), newLabel, x, y, width, height, fontSize, policy\n\n4. add_edge \u2014 Agregar flujo/conexi\u00F3n\n   Campos: sourceId (id o label del origen), targetId (id o label del destino), edgeLabel (guarda o texto), edgeStyle (solid|dashed), edgeColor\n   Lenguaje natural aceptado: conectar, relacionar, unir, vincular, enlazar, asociar, ligar, tirar l\u00EDnea, juntar, pasar a, mandar a\n\n5. delete_edge \u2014 Eliminar flujo\n   Campos: edgeId, o sourceId+targetId para buscar por extremos\n\n6. update_edge \u2014 Modificar un flujo existente\n   Campos: edgeId (o sourceId+targetId), edgeLabel, edgeStyle, edgeColor\n\n7. move_node_to_lane \u2014 Mover una actividad a otro carril, preservando conexiones\n   Campos: nodeId o label, targetLaneName (nombre del carril destino)\n\n8. reconnect_edge \u2014 Reconectar un flujo existente a nuevos extremos\n   Campos: edgeId (o sourceId+targetId actual), newSourceId, newTargetId\n\n9. reorder_lanes \u2014 Reorganizar el orden horizontal de carriles (de izquierda a derecha)\n   Campos: laneOrder (array de nombres de carriles en el orden deseado)\n\n10. batch_update_style \u2014 Cambiar estilo en lote a todos los nodos de un tipo\n    Campos: targetType (tipo de nodo), fontSize, width, height\n\n11. auto_layout \u2014 Reorganizar posiciones autom\u00E1ticamente para mejor legibilidad\n    (sin campos adicionales, el frontend optimiza posiciones)\n\n12. clear_all \u2014 Vaciar el diagrama completo\n\n\u2550\u2550\u2550 INTELIGENCIA DE POSICIONAMIENTO \u2550\u2550\u2550\nEl usuario no sabe de coordenadas ni de reglas estrictas. Haz el trabajo pesado:\n- Los carriles son COLUMNAS: x crece por carril y y inicia en 0\n- Si hay carriles, coloca el nodo DENTRO del carril apropiado (x entre lane.x y lane.x + lane.width)\n- Mant\u00E9n separaci\u00F3n vertical de ~140px entre nodos consecutivos dentro del mismo carril\n- En carriles nuevos usa width=300 y height=520 como base\n- Si se agrega un carril sin nombre, usa nomenclatura secuencial: Calle 1, Calle 2, Calle 3...\n- Autocentrado: Calcula las coordenadas X/Y para que los nuevos nodos queden alineados a su contenedor\n\n\u2550\u2550\u2550 CORRECCI\u00D3N UML SILENCIOSA \u2550\u2550\u2550\n- M\u00E1ximo 1 nodo de inicio (start) por diagrama. Si ya hay uno, NO crear otro.\n- Las compuertas de decisi\u00F3n DEBEN tener etiquetas/guardas en cada flujo saliente (ej: \"[S\u00ED]\", \"[No]\")\n- Si una instrucci\u00F3n viola UML, ad\u00E1ptala silenciosamente para que funcione en vez de bloquear\n- Si no puedes corregirlo, reporta en \"umlValidation\"\n\n\u2550\u2550\u2550 REGLA DE CONFIRMACI\u00D3N \u2550\u2550\u2550\n- Si el usuario pide optimizaci\u00F3n global o mejora estructural compleja, NO mutar todav\u00EDa.\n- Responde con commands: [] y en user_feedback pregunta: \"\u00BFQuieres que aplique estos cambios por ti?\"\n- Solo ejecutar cambios masivos cuando el usuario confirme (s\u00ED, procesa, hazlo, dale).\n\n\u2550\u2550\u2550 FORMATO DE RESPUESTA (JSON ESTRICTO) \u2550\u2550\u2550\nResponde SIEMPRE y \u00DANICAMENTE con JSON v\u00E1lido. Sin markdown, sin texto fuera del JSON.\n\n{\n  \"user_feedback\": \"Un mensaje emp\u00E1tico, amigable y coloquial de m\u00E1ximo 2 l\u00EDneas explicando lo que hiciste.\",\n  \"commands\": [\n    {\n      \"action\": \"nombre_del_comando_exacto\",\n      \"nodeType\": \"tipo_si_aplica\",\n      \"nodeId\": \"id_si_aplica\",\n      \"label\": \"nombre_del_nodo\",\n      \"newLabel\": \"nuevo_nombre_si_aplica\",\n      \"x\": 100,\n      \"y\": 200,\n      \"width\": 160,\n      \"height\": 80,\n      \"fontSize\": 12,\n      \"sourceId\": \"id_o_label_origen\",\n      \"targetId\": \"id_o_label_destino\",\n      \"edgeLabel\": \"guarda_o_texto\",\n      \"edgeStyle\": \"solid\",\n      \"edgeColor\": \"#455a64\",\n      \"targetLaneName\": \"nombre_carril_destino\",\n      \"laneOrder\": [\"carril1\", \"carril2\"],\n      \"targetType\": \"tipo_de_nodo_para_batch\"\n    }\n  ],\n  \"umlValidation\": \"advertencia UML si aplica, o null\"\n}\n\nReglas:\n1. \"action\" solo puede ser uno de los 12 comandos listados.\n2. Si la instrucci\u00F3n no requiere manipular el diagrama (ej. saludo), commands debe ser [].\n3. La respuesta debe ser parseable por JSON.parse().\n\nFormato alternativo TAMBI\u00C9N aceptado (legacy):\n{\n  \"assistant_speech\": \"texto\",\n  \"operations\": [ { \"action\": \"CREATE\", \"element_type\": \"node\", \"target_id\": null, \"payload\": {} } ]\n}\n\n\u2550\u2550\u2550 EJEMPLOS \u2550\u2550\u2550\n\nUsuario: \"Ponme un cuadrito que diga Cobro\"\n\u2192 { \"user_feedback\": \"\u00A1Listo! Puse una actividad llamada Cobro.\", \"commands\": [{ \"action\": \"add_node\", \"nodeType\": \"activity\", \"label\": \"Cobro\" }] }\n\nUsuario: \"Crea una zona de ventas, mete ah\u00ED el cobro y m\u00E1ndalo al fin\"\n\u2192 { \"user_feedback\": \"\u00A1Hecho! Cre\u00E9 la zona Ventas, agregu\u00E9 Cobro dentro y lo conect\u00E9 al Fin.\", \"commands\": [\n  { \"action\": \"add_node\", \"nodeType\": \"swimlane\", \"label\": \"Ventas\", \"x\": 0, \"y\": 0, \"width\": 300, \"height\": 520 },\n  { \"action\": \"add_node\", \"nodeType\": \"activity\", \"label\": \"Cobro\", \"x\": 50, \"y\": 100 },\n  { \"action\": \"add_edge\", \"sourceId\": \"Cobro\", \"targetId\": \"Fin\", \"edgeStyle\": \"solid\" }\n] }\n\nUsuario: \"Agrega una decisi\u00F3n '\u00BFAprobado?' despu\u00E9s de Revisi\u00F3n con caminos S\u00ED a Procesar y No a Rechazo\"\n\u2192 { \"user_feedback\": \"\u00A1Perfecto! Puse la decisi\u00F3n \u00BFAprobado? con sus dos caminos.\", \"commands\": [\n  { \"action\": \"add_node\", \"nodeType\": \"decision\", \"label\": \"\u00BFAprobado?\", \"x\": 400, \"y\": 200 },\n  { \"action\": \"add_edge\", \"sourceId\": \"Revisi\u00F3n\", \"targetId\": \"\u00BFAprobado?\", \"edgeStyle\": \"solid\" },\n  { \"action\": \"add_edge\", \"sourceId\": \"\u00BFAprobado?\", \"targetId\": \"Procesar\", \"edgeLabel\": \"[S\u00ED]\", \"edgeStyle\": \"solid\" },\n  { \"action\": \"add_edge\", \"sourceId\": \"\u00BFAprobado?\", \"targetId\": \"Rechazo\", \"edgeLabel\": \"[No]\", \"edgeStyle\": \"solid\" }\n] }");
        var headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': "Bearer ".concat(this.API_KEY)
        });
        var body = {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
        };
        return this.http.post(this.GROQ_API_URL, body, { headers: headers }).pipe(map(function (response) {
            var _a, _b;
            var content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
            if (!content)
                throw new Error('No response from AI');
            var parsed = JSON.parse(content);
            return _this.normalizeIaResponse(parsed, userMessage, currentNodes);
        }), catchError(function (err) {
            console.error('[IA] Error calling Groq API:', err);
            var fallback = _this.localFallback(userMessage, currentNodes);
            if (fallback.commands.length > 0) {
                return of(fallback);
            }
            return throwError(function () { return new Error('Error communicating with AI: ' + (err.message || 'Unknown error')); });
        }));
    };
    IaService.prototype.normalizeIaResponse = function (raw, userMessage, currentNodes) {
        var _a;
        var normalizedMessage = this.resolveLatestIntent(userMessage);
        if (this.requiresConfirmation(normalizedMessage) && !this.isConfirmed(normalizedMessage)) {
            return {
                commands: [],
                explanation: 'Detecté una mejora estructural del flujo. ¿Quieres que aplique estos cambios por ti?',
                user_feedback: 'Detecté una mejora. ¿Quieres que aplique los cambios?',
                umlValidation: undefined
            };
        }
        // Support new format { user_feedback, commands[{ action, payload }] }
        // as well as legacy { commands } and { operations } formats
        var inputCommands;
        if (Array.isArray(raw === null || raw === void 0 ? void 0 : raw.commands)) {
            // Check if commands use the new payload-wrapped format
            inputCommands = raw.commands.map(function (cmd) {
                if (cmd.payload && typeof cmd.payload === 'object') {
                    // New format: flatten payload into the command
                    return __assign({ action: cmd.action }, cmd.payload);
                }
                return cmd;
            });
        }
        else {
            inputCommands = this.mapOperationsToCommands(Array.isArray(raw === null || raw === void 0 ? void 0 : raw.operations) ? raw.operations : []);
        }
        var normalized = [];
        var nextLaneX = this.getNextLaneX(currentNodes);
        for (var _i = 0, inputCommands_1 = inputCommands; _i < inputCommands_1.length; _i++) {
            var cmd = inputCommands_1[_i];
            var fixed = this.normalizeCommand(cmd, nextLaneX, currentNodes);
            if (fixed) {
                if (fixed.action === 'add_node' && fixed.nodeType === 'swimlane') {
                    nextLaneX += fixed.width || 300;
                }
                normalized.push(fixed);
            }
        }
        // En instrucciones explícitas de una sola acción, no ejecutar acciones adicionales.
        var strictSingle = this.enforceSingleAction(normalizedMessage, normalized);
        var fallback = strictSingle.length === 0 ? this.localFallback(normalizedMessage, currentNodes).commands : [];
        // Extract user_feedback from new format, or assistant_speech from legacy
        var userFeedback = typeof (raw === null || raw === void 0 ? void 0 : raw.user_feedback) === 'string' ? raw.user_feedback.trim() : '';
        var assistantSpeech = typeof (raw === null || raw === void 0 ? void 0 : raw.assistant_speech) === 'string' ? raw.assistant_speech.trim() : '';
        var displayMessage = userFeedback || assistantSpeech;
        return {
            commands: strictSingle.length > 0 ? strictSingle : fallback,
            explanation: displayMessage || (typeof (raw === null || raw === void 0 ? void 0 : raw.explanation) === 'string' && raw.explanation.trim().length > 0
                ? raw.explanation
                : 'Comando interpretado y normalizado correctamente.'),
            user_feedback: userFeedback || undefined,
            umlValidation: (_a = raw === null || raw === void 0 ? void 0 : raw.umlValidation) !== null && _a !== void 0 ? _a : null
        };
    };
    IaService.prototype.enforceSingleAction = function (message, commands) {
        // Permitir operaciones en lote sin truncar
        return commands;
    };
    IaService.prototype.parseLaneReference = function (message) {
        if (!message)
            return null;
        var byNumber = message.match(/(?:en|a|al|hacia)\s+(?:el\s+|la\s+)?(?:calle|carril|swimlane|zona|area|seccion)\s*(\d+)/i);
        if (byNumber === null || byNumber === void 0 ? void 0 : byNumber[1])
            return byNumber[1];
        var byName = message.match(/(?:en|a|al|hacia)\s+(?:el\s+|la\s+)?(?:calle|carril|swimlane|zona|area|seccion)\s+([\p{L}\d_-]+)/iu);
        return (byName === null || byName === void 0 ? void 0 : byName[1]) || null;
    };
    IaService.prototype.resolveLaneFromReference = function (reference, nodes) {
        var matches = this.findLaneMatches(reference, nodes);
        return matches.length > 0 ? matches[0] : null;
    };
    IaService.prototype.getNextNodeYInLane = function (lane, nodes) {
        var laneX = lane.x || 0;
        var laneW = lane.width || 300;
        var laneY = lane.y || 0;
        var laneHeader = 70;
        var nodeBottoms = nodes
            .filter(function (n) { return n.type !== 'swimlane' && (n.x || 0) >= laneX && (n.x || 0) < (laneX + laneW); })
            .map(function (n) { return (n.y || 0) + (n.height || 80); });
        if (!nodeBottoms.length)
            return laneY + laneHeader;
        return Math.max.apply(Math, nodeBottoms) + 40;
    };
    IaService.prototype.mapOperationsToCommands = function (operations) {
        var mapped = [];
        for (var _i = 0, operations_1 = operations; _i < operations_1.length; _i++) {
            var op = operations_1[_i];
            var cmd = this.mapOperationToCommand(op);
            if (cmd)
                mapped.push(cmd);
        }
        return mapped;
    };
    IaService.prototype.mapOperationToCommand = function (op) {
        var _a, _b, _c;
        if (!op || typeof op !== 'object')
            return null;
        var action = (op.action || '').toUpperCase();
        var type = (op.element_type || '').toLowerCase();
        var id = op.target_id || undefined;
        var x = (_a = op.payload) === null || _a === void 0 ? void 0 : _a.x;
        var y = (_b = op.payload) === null || _b === void 0 ? void 0 : _b.y;
        var p = ((_c = op.payload) === null || _c === void 0 ? void 0 : _c.properties) || {};
        if (action === 'CREATE') {
            if (type === 'edge') {
                return {
                    action: 'add_edge',
                    sourceId: p['sourceId'] || p['source'] || p['from'],
                    targetId: p['targetId'] || p['target'] || p['to'],
                    edgeLabel: p['edgeLabel'] || p['label'],
                    edgeStyle: p['edgeStyle'] || p['style'],
                    edgeColor: p['edgeColor'] || p['color']
                };
            }
            if (type === 'swimlane' || type === 'node') {
                return {
                    action: 'add_node',
                    nodeType: type === 'swimlane' ? 'swimlane' : (p['nodeType'] || p['type'] || 'activity'),
                    label: p['label'] || p['name'],
                    x: x,
                    y: y,
                    width: p['width'],
                    height: p['height'],
                    fontSize: p['fontSize'],
                    responsible: p['responsible']
                };
            }
            return null;
        }
        if (action === 'UPDATE' || action === 'RESIZE') {
            if (type === 'edge') {
                return {
                    action: 'update_edge',
                    edgeId: id,
                    edgeLabel: p['edgeLabel'] || p['label'],
                    edgeStyle: p['edgeStyle'] || p['style'],
                    edgeColor: p['edgeColor'] || p['color']
                };
            }
            if (type === 'swimlane' || type === 'node') {
                return {
                    action: 'update_node',
                    nodeId: id,
                    newLabel: p['newLabel'] || p['label'] || p['name'],
                    x: x,
                    y: y,
                    width: p['width'],
                    height: p['height'],
                    fontSize: p['fontSize'],
                    policy: p['policy']
                };
            }
            return null;
        }
        if (action === 'MOVE') {
            if (type === 'node' || type === 'swimlane') {
                if (p['targetLaneName']) {
                    return {
                        action: 'move_node_to_lane',
                        nodeId: id,
                        targetLaneName: p['targetLaneName']
                    };
                }
                return {
                    action: 'update_node',
                    nodeId: id,
                    x: x,
                    y: y
                };
            }
            return null;
        }
        if (action === 'DELETE') {
            if (type === 'edge')
                return { action: 'delete_edge', edgeId: id };
            if (type === 'node' || type === 'swimlane')
                return { action: 'delete_node', nodeId: id };
            return null;
        }
        return null;
    };
    IaService.prototype.normalizeCommand = function (cmd, nextLaneX, currentNodes) {
        if (!cmd || typeof cmd !== 'object')
            return null;
        var actionAlias = {
            create_node: 'add_node',
            remove_node: 'delete_node',
            edit_node: 'update_node',
            connect_nodes: 'add_edge',
            remove_edge: 'delete_edge',
            edit_edge: 'update_edge',
            move_to_lane: 'move_node_to_lane',
            relink_edge: 'reconnect_edge',
            reorder_swimlanes: 'reorder_lanes',
            style_batch: 'batch_update_style',
            autolayout: 'auto_layout',
            clear: 'clear_all'
        };
        var action = ((cmd.action && actionAlias[cmd.action]) || cmd.action);
        var fixed = __assign(__assign({}, cmd), { action: action });
        if (fixed.action === 'add_node' && fixed.nodeType === 'swimlane') {
            fixed.width = fixed.width || 300;
            fixed.height = fixed.height || 520;
            fixed.y = 0;
            if (fixed.x === undefined || fixed.x === null)
                fixed.x = nextLaneX;
            if (!fixed.label || !fixed.label.trim()) {
                fixed.label = this.getNextLaneName(currentNodes);
            }
        }
        if (fixed.action === 'reorder_lanes' && (!Array.isArray(fixed.laneOrder) || fixed.laneOrder.length === 0)) {
            fixed.laneOrder = undefined;
        }
        return fixed;
    };
    IaService.prototype.getNextLaneX = function (nodes) {
        var lanes = nodes.filter(function (n) { return n.type === 'swimlane'; });
        if (lanes.length === 0)
            return 0;
        return Math.max.apply(Math, lanes.map(function (l) { return (l.x || 0) + (l.width || 300); }));
    };
    IaService.prototype.getNextLaneName = function (nodes) {
        if (nodes === void 0) { nodes = []; }
        var lanes = nodes.filter(function (n) { return n.type === 'swimlane'; });
        var used = new Set();
        for (var _i = 0, lanes_1 = lanes; _i < lanes_1.length; _i++) {
            var lane = lanes_1[_i];
            var m = (lane.label || '').match(/^Calle\s+(\d+)$/i);
            if (m)
                used.add(Number(m[1]));
        }
        var i = 1;
        while (used.has(i))
            i += 1;
        return "Calle ".concat(i);
    };
    IaService.prototype.resolveLatestIntent = function (message) {
        var _a;
        if (!message)
            return '';
        var cutRegex = /(no\s*,?\s*espera|espera\s*,?\s*mejor|mejor|corrijo|corrección)/gi;
        var matches = __spreadArray([], message.matchAll(cutRegex), true);
        if (matches.length === 0)
            return message;
        var last = matches[matches.length - 1];
        var idx = ((_a = last.index) !== null && _a !== void 0 ? _a : 0) + last[0].length;
        return message.slice(idx).trim() || message;
    };
    IaService.prototype.requiresConfirmation = function (message) {
        return IaService.IMPROVEMENT_WORDS.test(message);
    };
    IaService.prototype.isConfirmed = function (message) {
        return IaService.CONFIRM_WORDS.test(message);
    };
    IaService.prototype.localFallback = function (userMessage, currentNodes) {
        var latestMessage = this.resolveLatestIntent(userMessage || '');
        var canonical = this.canonicalizeText(latestMessage);
        var text = canonical.toLowerCase();
        var commands = [];
        if (IaService.INTERRUPT_WORDS.test(text) && !/(agrega|añade|crea|mueve|borra|elimina|ordena|organiza|limpiar|vaciar)/.test(text)) {
            return {
                commands: [],
                explanation: 'Operación detenida por instrucción del usuario.',
                umlValidation: undefined
            };
        }
        if (this.requiresConfirmation(latestMessage) && !this.isConfirmed(latestMessage)) {
            return {
                commands: [],
                explanation: 'Detecté una mejora estructural del flujo. ¿Quieres que aplique estos cambios por ti?',
                umlValidation: undefined
            };
        }
        var simulatedNodes = __spreadArray([], currentNodes, true);
        var steps = this.splitIntoSteps(canonical);
        for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
            var step = steps_1[_i];
            var normalizedStep = step.toLowerCase().trim();
            if (!normalizedStep)
                continue;
            var ambiguityQuestion = this.buildAmbiguityQuestion(step, simulatedNodes);
            if (ambiguityQuestion) {
                return {
                    commands: [],
                    explanation: ambiguityQuestion,
                    umlValidation: undefined
                };
            }
            var missingLaneQuestion = this.buildMissingLaneQuestion(step, simulatedNodes);
            if (missingLaneQuestion) {
                return {
                    commands: [],
                    explanation: missingLaneQuestion,
                    umlValidation: undefined
                };
            }
            var missingNodeQuestion = this.buildMissingNodeQuestion(step, simulatedNodes);
            if (missingNodeQuestion) {
                return {
                    commands: [],
                    explanation: missingNodeQuestion,
                    umlValidation: undefined
                };
            }
            if (/limpiar|vaciar|borrar\s+todo|clear\s+all/.test(normalizedStep)) {
                commands.push({ action: 'clear_all' });
                continue;
            }
            if (/auto\s*layout|autolayout|ordena|organiza|acomoda|distribuye/.test(normalizedStep)) {
                commands.push({ action: 'auto_layout' });
                continue;
            }
            var addNode = this.tryParseAddNode(step, simulatedNodes);
            if (addNode) {
                commands.push(addNode);
                simulatedNodes.push({
                    id: "sim_".concat(Date.now(), "_").concat(Math.random()),
                    type: addNode.nodeType || 'activity',
                    label: addNode.label || '',
                    x: addNode.x || 0,
                    y: addNode.y || 0,
                    width: addNode.width || 160,
                    height: addNode.height || 80
                });
                continue;
            }
            var moveNode = this.tryParseMoveNode(step, simulatedNodes);
            if (moveNode) {
                commands.push(moveNode);
                continue;
            }
            var renameNode = this.tryParseRename(step, currentNodes);
            if (renameNode) {
                commands.push(renameNode);
                continue;
            }
            var naturalEdge = this.tryBuildAddEdgeFromNaturalLanguage(step, currentNodes);
            if (naturalEdge) {
                commands.push(naturalEdge);
                continue;
            }
            var deleteEdge = this.tryParseDeleteEdge(step, currentNodes);
            if (deleteEdge) {
                commands.push(deleteEdge);
                continue;
            }
            var deleteInLane = this.tryParseDeleteNodesInLane(step, currentNodes);
            if (deleteInLane) {
                commands.push.apply(commands, deleteInLane);
                continue;
            }
            var styling = this.tryParseStyle(step, currentNodes);
            if (styling) {
                if (Array.isArray(styling))
                    commands.push.apply(commands, styling);
                else
                    commands.push(styling);
                continue;
            }
            var removeNode = this.tryParseDeleteNode(step, currentNodes);
            if (removeNode) {
                commands.push(removeNode);
                continue;
            }
            var generalUpd = this.tryParseGeneralUpdate(step, currentNodes);
            if (generalUpd) {
                commands.push(generalUpd);
                continue;
            }
        }
        if (commands.length > 1) {
            return {
                commands: commands,
                explanation: 'Se procesó un lote de instrucciones en orden secuencial.',
                umlValidation: undefined
            };
        }
        return {
            commands: commands,
            explanation: commands.length > 0
                ? 'Se aplicó una interpretación local del comando para mantener la operación.'
                : 'No se pudo interpretar el comando con suficiente precisión.',
            umlValidation: undefined
        };
    };
    IaService.prototype.canonicalizeText = function (message) {
        var value = (message || '').trim();
        // Remover puntuación final agresiva que rompe el split o la detección
        value = value.replace(/[.,:;!¡?¿]+$/g, '');
        // Remover frases de ruido / cortesía
        var noise = [
            /por\s+favor/gi, /puedes/gi, /me\s+gustaria\s+que/gi, /me\s+gustaría\s+que/gi,
            /quisiera/gi, /haz\s+que/gi, /deberias\s+de/gi, /deberías\s+de/gi,
            /quiero\s+que/gi, /procede\s+a/gi, /favor\s+de/gi, /necesito\s+que/gi
        ];
        noise.forEach(function (r) { return value = value.replace(r, ''); });
        var replacements = [
            [/\brelasion(ar|a|o)?\b/gi, 'relacionar'],
            [/\bconekt(ar|a|o)?\b/gi, 'conectar'],
            [/\benlas(ar|a|o)?\b/gi, 'enlazar'],
            [/\bactividada?s?\b/gi, 'actividad'],
            [/\bclle?s?\b/gi, 'calle'],
            [/\bcaye?s?\b/gi, 'calle'],
            [/\bcarriles?\b/gi, 'carril'],
            [/\bdespues\b/gi, 'después'],
            [/\bqita\b/gi, 'quita'],
            // Colloquial aliases → technical terms
            [/\bcuadrit?o?s?\b/gi, 'actividad'],
            [/\bcajit?a?s?\b/gi, 'actividad'],
            [/\bbloque?s?\b/gi, 'actividad'],
            [/\bpas(?:it)?o?s?\b/gi, 'actividad'],
            [/\bbolit?a?s?\b/gi, 'inicio'],
            [/\bpregunt?a?s?\b/gi, 'decision'],
            [/\bfiltro?s?\b/gi, 'decision'],
            [/\bromb(?:it)?o?s?\b/gi, 'decision'],
            [/\bzona?s?\b/gi, 'calle'],
            [/\barea?s?\b/gi, 'calle'],
            [/\bseccione?s?\b/gi, 'calle'],
            [/\bcomienza?o?\b/gi, 'inicio'],
            [/\bsalida?s?\b/gi, 'fin'],
            [/\bpost-?its?\b/gi, 'nota'],
            [/\bdiscos?\b/gi, 'datastore'],
            // Connect aliases
            [/\btiral[ea]\b/gi, 'conectar'],
            [/\bjuntal[oa]s?\b/gi, 'conectar'],
            [/\bpasal[oa]\b/gi, 'conectar'],
            [/\bmandal[oa]\b/gi, 'conectar']
        ];
        for (var _i = 0, replacements_1 = replacements; _i < replacements_1.length; _i++) {
            var _a = replacements_1[_i], pattern = _a[0], replacement = _a[1];
            value = value.replace(pattern, replacement);
        }
        return value.replace(/\s+/g, ' ').trim();
    };
    IaService.prototype.splitIntoSteps = function (message) {
        return (message || '')
            .split(/\s*(?:,|;|\by\b|\bluego\b|\bdespués\b|\bentonces\b|\by\s+luego\b)\s*/i)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    };
    IaService.prototype.tryParseAddNode = function (step, currentNodes) {
        var _this = this;
        var s = step.toLowerCase();
        var asksAdd = /(agrega|añade|crea|inserta|pon|ponme|coloca|genera|haz|mete|dame|plantea|proyecta|instala|dibuja|traza|abre|dispone|sitúa|situa)/.test(s);
        if (!asksAdd)
            return null;
        // Caso prioritario: "agrega actividad/tarea en la calle/carril X"
        // No debe crear una calle nueva si la calle ya existe.
        var asksActivity = /(actividad|tarea|task|cuadrit|cajit|bloque|paso)/.test(this.normalizeForSearch(step));
        if (asksActivity) {
            var laneRef_1 = this.parseLaneReference(step);
            if (laneRef_1) {
                var lane = this.resolveLaneFromReference(laneRef_1, currentNodes);
                if (lane) {
                    return {
                        action: 'add_node',
                        nodeType: 'activity',
                        label: this.extractLabel(step, ['actividad', 'tarea', 'task']) || this.defaultLabelForNode('activity'),
                        x: (lane.x || 0) + 50,
                        y: this.getNextNodeYInLane(lane, currentNodes)
                    };
                }
            }
        }
        var nodeType = this.detectNodeType(step);
        if (!nodeType)
            return null;
        if (nodeType === 'swimlane') {
            var label_1 = this.extractLabel(step, ['calle', 'carril', 'swimlane', 'zona', 'area', 'seccion', 'fila', 'banda', 'pasillo', 'pool', 'departamento', 'sector', 'estrato', 'nivel', 'columna']) ||
                this.extractFallbackLabel(step, ['agrega', 'crea', 'añade', 'inserta', 'pon', 'calle', 'carril', 'swimlane', 'plantea', 'proyecta', 'instala', 'dibuja', 'traza', 'abre', 'dispone', 'sitúa', 'situa']) ||
                this.getNextLaneName(currentNodes);
            label_1 = label_1.replace(/^(una|un|el|la|los|las)\s+/i, '').trim();
            var alreadyExists = currentNodes
                .filter(function (n) { return n.type === 'swimlane' && !!n.label; })
                .some(function (n) { return _this.normalizeForSearch(n.label || '') === _this.normalizeForSearch(label_1); });
            if (alreadyExists) {
                label_1 = "".concat(label_1, " ").concat(currentNodes.filter(function (n) { return n.type === 'swimlane'; }).length + 1);
            }
            return {
                action: 'add_node',
                nodeType: 'swimlane',
                label: this.capitalize(label_1),
                x: this.getNextLaneX(currentNodes),
                y: 0,
                width: 300,
                height: 520
            };
        }
        var laneRef = this.parseLaneReference(step);
        var label = this.extractLabel(step, ['actividad', 'tarea', 'decision', 'decisión', 'nodo', 'subproceso', 'proceso', 'inicio', 'fin']) ||
            this.extractFallbackLabel(step, ['agrega', 'crea', 'añade', 'inserta', 'pon', 'coloca', 'actividad', 'tarea']) ||
            this.defaultLabelForNode(nodeType);
        if (laneRef) {
            var lane = this.resolveLaneFromReference(laneRef, currentNodes);
            if (lane) {
                return {
                    action: 'add_node',
                    nodeType: nodeType,
                    label: this.capitalize(label),
                    x: (lane.x || 0) + 50,
                    y: this.getNextNodeYInLane(lane, currentNodes)
                };
            }
        }
        return {
            action: 'add_node',
            nodeType: nodeType,
            label: this.capitalize(label)
        };
    };
    IaService.prototype.extractFallbackLabel = function (step, stopWords) {
        var words = step.split(/\s+/);
        // Intentar tomar la última palabra que no sea un verbo de acción o palabra clave de tipo
        for (var i = words.length - 1; i >= 0; i--) {
            var w = words[i].toLowerCase().replace(/[^\p{L}\d]/gu, '');
            if (w.length > 2 && !stopWords.map(function (s) { return s.toLowerCase(); }).includes(w)) {
                return words[i].replace(/[^\p{L}\d]/gu, '');
            }
        }
        return null;
    };
    IaService.prototype.capitalize = function (s) {
        if (!s)
            return s;
        return s.charAt(0).toUpperCase() + s.slice(1);
    };
    IaService.prototype.detectNodeType = function (step) {
        var s = this.normalizeForSearch(step);
        // Priorizar componentes operativos antes de interpretar "calle" como tipo.
        if (/(actividad|tarea|task|cuadrit|cajit|bloque|paso)/.test(s))
            return 'activity';
        if (/(subproceso|subprocess)/.test(s))
            return 'subprocess';
        if (/(decision|decisión|merge|xor|pregunt|filtro|rombit|si\/no)/.test(s))
            return 'decision';
        if (/(parallel|paralelo|and\s*gate|compuerta\s*paralela)/.test(s))
            return 'parallel';
        if (/(\bfork\b)/.test(s))
            return 'fork';
        if (/(\bjoin\b)/.test(s))
            return 'join';
        if (/(señal|senal).*(enviar|send)|signal\s*send/.test(s))
            return 'signal_send';
        if (/(señal|senal).*(recibir|receive)|signal\s*receive/.test(s))
            return 'signal_receive';
        if (/(nota|note|comentario|post-?it)/.test(s))
            return 'note';
        if (/(datastore|almacen|almacén|base\s*de\s*datos|disco)/.test(s))
            return 'datastore';
        if (/(swimlane|calle|carril|zona|area|seccion|bloque\s*horizontal|fila|banda|pista|callejón|callejon|pasillo|pool|departamento|sector|estrato|nivel|columna|contenedor)/.test(s))
            return 'swimlane';
        if (/(inicio|start|bolit|comienzo|circulit|verde|comenzar|punto\s+de\s+partida|arranque)/.test(s))
            return 'start';
        if (/(fin\s*\(flujo\)|fin\s*flujo|flow\s*final|circulo\s*doble|meta|objetivo)/.test(s))
            return 'flow_final';
        if (/(fin\s*\(actividad\)|fin\s*actividad|activity\s*final|bloqueo|cierre)/.test(s))
            return 'activity_final';
        if (/(\bfin\b|\bfinal\b|\bend\b|salida|terminar|concluir|rojo|parada)/.test(s))
            return 'end';
        return null;
    };
    IaService.prototype.tryParseGeneralUpdate = function (step, nodes) {
        var s = step.toLowerCase();
        // 1. Detección de actualización por Responsable
        var respMatch = step.match(/(?:responsable|encargado|dueno|dueño|quien\s+hace|lo\s+hace|quien\s+lo\s+hace|persona)\s+(?:es|sea|de|a)?\s*"?([\p{L}\d_ -]+)"?/iu);
        if (respMatch === null || respMatch === void 0 ? void 0 : respMatch[1]) {
            var target = this.resolveNodeLabelFromReference(step.replace(respMatch[0], ''), nodes);
            if (target) {
                return { action: 'update_node', label: target, responsible: respMatch[1].trim() };
            }
        }
        // 2. Detección de Normatividad/Política
        var polMatch = step.match(/(?:politica|política|norma|regla|procedimiento)\s+(?:es|sea|de|a)?\s*"?([\p{L}\d_\s.,-]{3,})"?/iu);
        if (polMatch === null || polMatch === void 0 ? void 0 : polMatch[1]) {
            var target = this.resolveNodeLabelFromReference(step.replace(polMatch[0], ''), nodes);
            if (target) {
                return { action: 'update_node', label: target, policy: polMatch[1].trim() };
            }
        }
        // 3. Detección de Colores de Nodo (Si no fue detectado por style batch)
        var colorMatch = s.match(/(?:pinta|colorea|pon|cambia|haz).*?(rojo|azul|verde|amarillo|naranja|negro|blanco)/i);
        if ((colorMatch === null || colorMatch === void 0 ? void 0 : colorMatch[1]) && !/(linea|arista|conexion|relacion|edge)/i.test(s)) {
            var colorMap = { rojo: '#F44336', azul: '#2196F3', verde: '#4CAF50', amarillo: '#FFEB3B', naranja: '#FF9800', negro: '#455a64', blanco: '#ECEFF1' };
            var target = this.resolveNodeLabelFromReference(step.replace(colorMatch[0], ''), nodes);
            // Nota: modeler.ts necesita ser actualizado para soportar nodeColor en update_node si se desea, 
            // pero por ahora lo dejamos como extensión de metadata o fallback.
        }
        return null;
    };
    IaService.prototype.extractLabel = function (step, keywords) {
        var quoted = step.match(/"([^"]+)"/);
        if (quoted === null || quoted === void 0 ? void 0 : quoted[1])
            return quoted[1].trim();
        var keys = keywords.join('|');
        var m = step.match(new RegExp("(?:".concat(keys, ")\\s+(?:llamada|llamado|nombre|con\\s+nombre)?\\s*([\\p{L}\\d_ -]{2,})"), 'iu'));
        if (!(m === null || m === void 0 ? void 0 : m[1]))
            return null;
        var value = m[1]
            .replace(/\b(en|a|al|con|sobre|dentro|del|de\s+la|de\s+el)\b.*$/i, '')
            .trim();
        return value || null;
    };
    IaService.prototype.defaultLabelForNode = function (nodeType) {
        var map = {
            activity: 'Actividad',
            decision: 'Condición',
            subprocess: 'Subproceso',
            start: 'Inicio',
            end: 'Fin',
            flow_final: 'Fin Flujo',
            activity_final: 'Fin Actividad',
            note: 'Nota',
            datastore: 'Datos',
            signal_send: 'Enviar Señal',
            signal_receive: 'Recibir Señal',
            parallel: 'Paralelo',
            fork: 'Fork/Join'
        };
        return map[nodeType] || 'Nodo';
    };
    IaService.prototype.tryParseMoveNode = function (step, currentNodes) {
        var s = step.toLowerCase();
        if (!/(muev[ae]|mover|traslad[ae]|pas[a|e|ar]|llev[a|e|ar]|cambia\s+de\s+(?:calle|zona)|acomod[ae]|ubic[ae]|situ[ae]|desplaz[ae])/i.test(s))
            return null;
        var laneRef = this.parseLaneReference(step);
        var lane = this.resolveLaneFromReference(laneRef, currentNodes);
        if (!lane)
            return null;
        var candidates = currentNodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label; });
        var quoted = step.match(/"([^"]+)"/);
        var nodeLabel = (quoted === null || quoted === void 0 ? void 0 : quoted[1])
            ? this.resolveNodeLabelFromReference(quoted[1], candidates)
            : this.resolveNodeLabelFromReference(step.replace(/(?:mueve|mover|traslada|pasar|llevar|a\s+la\s+calle|al\s+carril).*/gi, '').trim(), candidates);
        if (!nodeLabel)
            return null;
        return {
            action: 'move_node_to_lane',
            label: nodeLabel,
            targetLaneName: lane.label || undefined
        };
    };
    IaService.prototype.tryParseStyle = function (step, currentNodes) {
        var s = step.toLowerCase();
        // 1. Agrandar texto o achicar
        if (/(agranda|aumenta|crece|sube|maximiza).*texto|texto.*(grande|mayor)/.test(s)) {
            return { action: 'batch_update_style', targetType: 'activity', fontSize: 16 };
        }
        if (/(achica|reduce|disminuye|baja|minimiza).*texto|texto.*(pequeno|pequeño|menor)/.test(s)) {
            return { action: 'batch_update_style', targetType: 'activity', fontSize: 10 };
        }
        // 2. Anchar calles
        if (/(ancha|ampli|agranda|engorda|ensancha).*calle|calle.*(ancha|grande)/.test(s)) {
            return { action: 'batch_update_style', targetType: 'swimlane', width: 450 };
        }
        if (/(angosta|estrech|achica|reduce|delgaza).*calle|calle.*(angosta|pequeña|fina)/.test(s)) {
            return { action: 'batch_update_style', targetType: 'swimlane', width: 200 };
        }
        // 3. Agrosar líneas
        if (/(engrosa|agros(?:a|e)|gruesa|ancha|gord).*linea/i.test(s) || /linea.*(gruesa|gord|ancha)/i.test(s) || /flecha.*(gruesa)/i.test(s)) {
            return { action: 'batch_update_style', targetType: 'edge', edgeThickness: 4 };
        }
        if (/(adelgaza|fina|delgada).*linea/i.test(s) || /linea.*(fina|delgada)/i.test(s) || /flecha.*(fina)/i.test(s)) {
            return { action: 'batch_update_style', targetType: 'edge', edgeThickness: 1 };
        }
        // 4. Cambiar color a líneas
        var colorMatch = s.match(/(?:pon|pinta|colorea|cambia|haz).*?(rojo|azul|verde|amarillo|naranja|negro|blanco)/i);
        if ((colorMatch === null || colorMatch === void 0 ? void 0 : colorMatch[1]) && /(linea|línea|flecha|ruta|conexion|conexión|arista|relacion|relación)/i.test(s)) {
            var colorMap = { rojo: '#F44336', azul: '#2196F3', verde: '#4CAF50', amarillo: '#FFEB3B', naranja: '#FF9800', negro: '#455a64', blanco: '#ECEFF1' };
            return { action: 'batch_update_style', targetType: 'edge', edgeColor: colorMap[colorMatch[1].toLowerCase()] };
        }
        return null;
    };
    IaService.prototype.tryParseDeleteNodesInLane = function (step, currentNodes) {
        var s = step.toLowerCase();
        if (!/(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|limpia|aniquila|liquida|purga|desecha|vuela|quiebra)\s+(todo|todas|los|las)/.test(s) &&
            !/(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|limpia|aniquila|liquida|purga|desecha|vuela|quiebra)\s+.*(nodos|componentes|actividades|tareas|elementos|cosas|pasos)/.test(s)) {
            return null;
        }
        var laneRef = this.parseLaneReference(step);
        if (!laneRef)
            return null;
        var lane = this.resolveLaneFromReference(laneRef, currentNodes);
        if (!lane)
            return null;
        var laneX = lane.x || 0;
        var laneW = lane.width || 300;
        var nodesInLane = currentNodes.filter(function (n) { return n.type !== 'swimlane' && (n.x || 0) >= laneX && (n.x || 0) < (laneX + laneW); });
        if (nodesInLane.length === 0)
            return null;
        return nodesInLane.map(function (n) { return ({ action: 'delete_node', label: n.label }); });
    };
    IaService.prototype.tryParseDeleteNode = function (step, currentNodes) {
        var s = step.toLowerCase();
        if (!/(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|aniquila|liquida|purga|desecha|vuela|quiebra)/.test(s))
            return null;
        // Evitar interceptar comandos de eliminar "líneas/edges"
        if (/(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta)/.test(s))
            return null;
        var candidates = currentNodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label; });
        var quoted = step.match(/"([^"]+)"/);
        var resolved = (quoted === null || quoted === void 0 ? void 0 : quoted[1])
            ? this.resolveNodeLabelFromReference(quoted[1], candidates)
            : this.resolveNodeLabelFromReference(step.replace(/(?:elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|aniquila|liquida|purga|desecha|vuela|quiebra)\s*/gi, ''), candidates);
        return resolved ? { action: 'delete_node', label: resolved } : null;
    };
    IaService.prototype.tryParseDeleteEdge = function (step, nodes) {
        var _this = this;
        var s = step.toLowerCase();
        if (!/(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|desconecta|desvincula)\s+.*(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta)/i.test(s) &&
            !/(linea|línea|arista|conexion|conexión|relacion|relación|edge|flecha|ruta).*(elimina|borra|quita|remueve|eliminar|suprime|desaparece|destruye|desconecta|desvincula)/i.test(s)) {
            return null;
        }
        var candidateNodes = nodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0; });
        if (candidateNodes.length < 1)
            return null;
        var relMatch = step.match(/(?:de|desde|entre)\s+(.+?)\s+(?:y|e|con|a|hacia|->)\s+(.+)/i);
        var srcLabel, tgtLabel;
        if ((relMatch === null || relMatch === void 0 ? void 0 : relMatch[1]) && (relMatch === null || relMatch === void 0 ? void 0 : relMatch[2])) {
            srcLabel = this.resolveNodeLabelFromReference(relMatch[1], candidateNodes);
            tgtLabel = this.resolveNodeLabelFromReference(relMatch[2], candidateNodes);
        }
        if (!srcLabel || !tgtLabel) {
            var normalizedMsg_1 = this.normalizeForSearch(step);
            var found = candidateNodes
                .map(function (n) { return ({
                label: n.label || '',
                idx: normalizedMsg_1.indexOf(_this.normalizeForSearch(n.label || ''))
            }); })
                .filter(function (x) { return x.idx >= 0; })
                .sort(function (a, b) { return b.label.length - a.label.length; }); // Sort by length descending to match longest name first
            if (found.length >= 2 && found[0].label !== found[1].label) {
                srcLabel = found[0].label;
                tgtLabel = found[1].label;
            }
        }
        if (srcLabel && tgtLabel) {
            return { action: 'delete_edge', sourceId: srcLabel, targetId: tgtLabel };
        }
        // Si no encontró un par, buscar un solo nodo para borrar TODAS sus conexiones
        var unMatch = step.match(/(?:de|del|desde|hacia|a|para)\s+(.+)/i);
        if (unMatch === null || unMatch === void 0 ? void 0 : unMatch[1]) {
            var single = this.resolveNodeLabelFromReference(unMatch[1], candidateNodes);
            if (single)
                return { action: 'delete_edge', sourceId: single };
        }
        return null;
    };
    IaService.prototype.buildMissingLaneQuestion = function (step, currentNodes) {
        var laneRef = this.parseLaneReference(step);
        if (!laneRef)
            return null;
        var lane = this.resolveLaneFromReference(laneRef, currentNodes);
        if (lane)
            return null;
        var laneName = /^\d+$/.test(laneRef) ? "Calle ".concat(laneRef) : laneRef;
        // Si la acción era agregar, ofrecer crearlo
        var normalized = this.normalizeForSearch(step);
        if (/(agrega|anade|añade|crea|inserta|pon|coloca|genera|haz)/.test(normalized)) {
            return "No encontr\u00E9 el carril \"".concat(laneName, "\". \u00BFQuieres que lo cree y luego aplique los cambios?");
        }
        return "La instrucci\u00F3n fall\u00F3 porque la calle o carril \"".concat(laneName, "\" no existe en tu diagrama. Revisa el nombre.");
    };
    IaService.prototype.buildMissingNodeQuestion = function (step, currentNodes) {
        var s = step.toLowerCase();
        // Si intenta relacionar
        if (this.isConnectIntent(step)) {
            var explicit = step.match(/(?:conecta|relaciona|une|unir|vincula|enlaza|asocia|liga|junta)(?:\s+el\s+flujo)?\s+(?:de\s+)?(.+?)\s+(?:con|a|hacia|y|->)\s+(.+)/i);
            if ((explicit === null || explicit === void 0 ? void 0 : explicit[1]) && (explicit === null || explicit === void 0 ? void 0 : explicit[2])) {
                var candidateNodes = currentNodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0; });
                var src = this.resolveNodeLabelFromReference(explicit[1], candidateNodes);
                var tgt = this.resolveNodeLabelFromReference(explicit[2], candidateNodes);
                if (!src)
                    return "Error al relacionar: No encontr\u00E9 el componente origen \"".concat(explicit[1].trim(), "\".");
                if (!tgt)
                    return "Error al relacionar: No encontr\u00E9 el destino \"".concat(explicit[2].trim(), "\" para relacionarlo.");
            }
        }
        // Si intenta eliminar un nodo específico
        if (/(elimina|borrar|borra|quita|remueve|eliminar)/.test(s) && !/(linea|línea|arista|conexion|conexión|relacion|relación|edge|todo|todas|los|las)/.test(s)) {
            var candidateNodes = currentNodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label; });
            var quoted = step.match(/"([^"]+)"/);
            var ref = (quoted === null || quoted === void 0 ? void 0 : quoted[1]) || step.replace(/(?:elimina|borrar|borra|quita|remueve|eliminar)\s*/gi, '').trim();
            // Cleanup prepositions
            ref = ref.replace(/^(el|la|los|las|un|una)\s+/i, '').trim();
            var resolved = this.resolveNodeLabelFromReference(ref, candidateNodes);
            if (!resolved && ref.length > 1) {
                return "Error de borrado: No logr\u00E9 encontrar nada llamado \"".concat(ref, "\" en el sistema.");
            }
        }
        return null;
    };
    IaService.prototype.tryParseRename = function (step, currentNodes) {
        var s = this.normalizeForSearch(step);
        if (!/(renombr[ae]|cambi[ae]|modific[ae]|actualiz[ae]|reemplaz[ae]|poner\s+nombre|ponle\s+nombre|llama(?:r|le)?|rectifica|ajusta|perfecciona|edita|reforma|altera)/.test(s)) {
            return null;
        }
        var parts = this.extractRenameParts(step);
        if (!parts)
            return null;
        var targetRef = parts.targetRef, newLabel = parts.newLabel, isLane = parts.isLane;
        if (!newLabel)
            return null;
        if (isLane) {
            var laneRef = this.parseLaneReference(targetRef) || targetRef;
            var lane = this.resolveLaneFromReference(laneRef, currentNodes);
            if (lane === null || lane === void 0 ? void 0 : lane.id) {
                return {
                    action: 'update_node',
                    nodeId: lane.id,
                    newLabel: newLabel
                };
            }
            return null;
        }
        var candidates = currentNodes.filter(function (n) { return !!n.label; });
        var resolved = this.resolveNodeLabelFromReference(targetRef, candidates);
        if (!resolved)
            return null;
        return {
            action: 'update_node',
            label: resolved,
            newLabel: newLabel
        };
    };
    IaService.prototype.extractRenameParts = function (step) {
        var trimmed = step.trim();
        // Check strict Lane renaming first
        var lanePattern = trimmed.match(/(?:renombr[ae]|cambi[ae](?:r)?|modific[ae](?:r)?|actualiz[ae](?:r)?|reemplaz[ae](?:r)?(?:\s+(?:el\s+)?nombre(?:\s+de)?)?)\s+(?:la\s+|el\s+)?((?:calle|carril|swimlane|zona|area|área)\s*[\p{L}\d_-]+)\s+(?:a|por|como)\s+"?([\p{L}\d_ -]{2,})"?$/iu);
        if ((lanePattern === null || lanePattern === void 0 ? void 0 : lanePattern[1]) && (lanePattern === null || lanePattern === void 0 ? void 0 : lanePattern[2])) {
            return {
                targetRef: lanePattern[1].trim(),
                newLabel: lanePattern[2].trim(),
                isLane: true
            };
        }
        // Node renaming (or fallback)
        var base = trimmed.match(/(?:renombr[ae]|cambi[ae](?:r)?|modific[ae](?:r)?|actualiz[ae](?:r)?|reemplaz[ae](?:r)?(?:\s+(?:el\s+)?nombre(?:\s+de)?)?|pon(?:er|le)?\s+nombre\s+(?:a|de)?|llámale|llama)\s+(?:la\s+|el\s+|al\s+)?(.+?)\s+(?:a|por|como)\s+"?([\p{L}\d_ -]{2,})"?$/iu);
        if ((base === null || base === void 0 ? void 0 : base[1]) && (base === null || base === void 0 ? void 0 : base[2])) {
            return {
                targetRef: base[1].replace(/^de\s+/i, '').trim(),
                newLabel: base[2].trim(),
                isLane: false
            };
        }
        return null;
    };
    IaService.prototype.isConnectIntent = function (text) {
        return /(conecta(?:r|le)?|relaciona(?:r|le)?|une(?:r|le)?|vincula(?:r|le)?|enlaza(?:r|le)?|asocia(?:r|le)?|liga(?:r|le)?|junta(?:r|le)?|tirale?|pasalo?|mandalo?|manda\s+a|pasa\s+a|tira.*linea|tira.*línea|apunta(?:le)?\s+a|dirige)/i.test(text || '');
    };
    IaService.prototype.normalizeForSearch = function (value) {
        return (value || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .trim();
    };
    IaService.prototype.resolveNodeLabelFromReference = function (ref, nodes) {
        var matches = this.findNodeMatches(ref, nodes);
        return matches.length > 0 ? (matches[0].label || null) : null;
    };
    IaService.prototype.findLaneMatches = function (reference, nodes) {
        var _this = this;
        var lanes = nodes
            .filter(function (n) { return n.type === 'swimlane'; })
            .sort(function (a, b) { return (a.x || 0) - (b.x || 0); });
        if (!reference || lanes.length === 0)
            return [];
        var ref = reference.trim();
        if (!ref)
            return [];
        if (/^\d+$/.test(ref)) {
            var idx_1 = Number(ref);
            var byLabel = lanes.find(function (l) { return _this.normalizeForSearch(l.label || '') === _this.normalizeForSearch("calle ".concat(idx_1)); });
            if (byLabel)
                return [byLabel];
            var byIndex = lanes[idx_1 - 1];
            return byIndex ? [byIndex] : [];
        }
        var target = this.normalizeForSearch(ref);
        var exact = lanes.filter(function (l) { return _this.normalizeForSearch(l.label || '') === target; });
        if (exact.length > 0)
            return exact;
        return lanes.filter(function (l) { return _this.normalizeForSearch(l.label || '').includes(target) || target.includes(_this.normalizeForSearch(l.label || '')); });
    };
    IaService.prototype.findNodeMatches = function (ref, nodes) {
        var _this = this;
        var cleanRef = (ref || '').replace(/["'.,;:!?()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanRef)
            return [];
        var candidates = nodes.filter(function (n) { return !!n.label && n.label.trim().length > 0; });
        var target = this.normalizeForSearch(cleanRef);
        var exact = candidates.filter(function (n) { return _this.normalizeForSearch(n.label || '') === target; });
        if (exact.length > 0)
            return exact;
        return candidates.filter(function (n) { return _this.normalizeForSearch(n.label || '').includes(target) || target.includes(_this.normalizeForSearch(n.label || '')); });
    };
    IaService.prototype.buildAmbiguityQuestion = function (step, nodes) {
        var laneRef = this.parseLaneReference(step);
        if (laneRef && !/^\d+$/.test(laneRef)) {
            var laneMatches = this.findLaneMatches(laneRef, nodes);
            if (laneMatches.length > 1) {
                var options = laneMatches
                    .sort(function (a, b) { return (a.x || 0) - (b.x || 0); })
                    .map(function (l, i) { return "".concat(i + 1, ") ").concat(l.label || 'Sin nombre'); })
                    .join(' | ');
                return "Encontr\u00E9 varios carriles con el nombre \"".concat(laneRef, "\". \u00BFCu\u00E1l quieres usar? ").concat(options);
            }
        }
        var quotedRefs = __spreadArray([], step.matchAll(/"([^"]+)"/g), true).map(function (m) { return m[1]; }).filter(Boolean);
        for (var _i = 0, quotedRefs_1 = quotedRefs; _i < quotedRefs_1.length; _i++) {
            var ref = quotedRefs_1[_i];
            var nodeMatches = this.findNodeMatches(ref, nodes);
            if (nodeMatches.length > 1) {
                var options = nodeMatches
                    .slice(0, 5)
                    .map(function (n, i) { return "".concat(i + 1, ") ").concat(n.label || 'Sin nombre', " (").concat(n.type, ")"); })
                    .join(' | ');
                return "Hay varios nodos llamados \"".concat(ref, "\". \u00BFCu\u00E1l quieres usar? ").concat(options);
            }
        }
        return null;
    };
    IaService.prototype.tryBuildAddEdgeFromNaturalLanguage = function (message, nodes) {
        var _this = this;
        if (!this.isConnectIntent(message))
            return null;
        var candidateNodes = nodes.filter(function (n) { return n.type !== 'swimlane' && !!n.label && n.label.trim().length > 0; });
        if (candidateNodes.length < 2)
            return null;
        // 1) Prioridad: nombres entre comillas, ej: relaciona "A" con "B"
        var quoted = __spreadArray([], message.matchAll(/"([^"]+)"/g), true).map(function (m) { return m[1]; }).filter(Boolean);
        if (quoted.length >= 2) {
            var src = this.resolveNodeLabelFromReference(quoted[0], candidateNodes);
            var tgt = this.resolveNodeLabelFromReference(quoted[1], candidateNodes);
            if (src && tgt && src !== tgt) {
                return { action: 'add_edge', sourceId: src, targetId: tgt, edgeStyle: 'solid' };
            }
        }
        // 2) Patrón natural: relacionar X con Y / unir X y Y / conectar X a Y
        var explicit = message.match(/(?:conecta(?:r)?|relaciona(?:r)?|une?|unir|vincula(?:r)?|enlaza(?:r)?|asocia(?:r)?|liga(?:r)?|junta(?:r)?)(?:\s+el\s+flujo)?\s+(?:de\s+)?(.+?)\s+(?:con|a|hacia|y|->)\s+(.+)/i);
        if ((explicit === null || explicit === void 0 ? void 0 : explicit[1]) && (explicit === null || explicit === void 0 ? void 0 : explicit[2])) {
            var src = this.resolveNodeLabelFromReference(explicit[1], candidateNodes);
            var tgt = this.resolveNodeLabelFromReference(explicit[2], candidateNodes);
            if (src && tgt && src !== tgt) {
                return { action: 'add_edge', sourceId: src, targetId: tgt, edgeStyle: 'solid' };
            }
        }
        // 3) Heurística: tomar los dos nodos mencionados en el texto por aparición
        var normalizedMsg = this.normalizeForSearch(message);
        var found = candidateNodes
            .map(function (n) { return ({
            label: n.label || '',
            idx: normalizedMsg.indexOf(_this.normalizeForSearch(n.label || ''))
        }); })
            .filter(function (x) { return x.idx >= 0; })
            .sort(function (a, b) { return a.idx - b.idx; });
        if (found.length >= 2 && found[0].label !== found[1].label) {
            return { action: 'add_edge', sourceId: found[0].label, targetId: found[1].label, edgeStyle: 'solid' };
        }
        return null;
    };
    IaService.CONFIRM_WORDS = /\b(si|sí|dale|procesa|hazlo|aplicar|aplícalo|ejecuta)\b/i;
    IaService.IMPROVEMENT_WORDS = /\b(mejorar|mejora|optimiza|optimizar|ayudame a mejorar|ayúdame a mejorar)\b/i;
    IaService.INTERRUPT_WORDS = /\b(alto|espera|cancela|cancelar|deten|detener)\b/i;
    return IaService;
}());
exports.IaService = IaService;
var service = new IaService();
var result = service.localFallback('Agrega una calle venta. escribi esa intruccion y no funciono', [{ id: 'n1', type: 'swimlane', label: 'Calle 1', width: 300, x: 0, y: 0 }]);
console.log(JSON.stringify(result, null, 2));
