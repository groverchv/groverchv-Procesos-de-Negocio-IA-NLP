# Despliegue con Docker Compose (Contenedores)

Para facilitar las pruebas, la defensa del código y la virtualización según nuestra Arquitectura, se ha orquestado todo el proyecto mediante **Docker Compose**.

## Arquitectura Virtualizada
Al levantar el proyecto, se instanciarán 4 contenedores aislados que se comunicarán a través de una red interna virtual (`bpm_network`):
1.  **`bpm_mongodb`**: Base de Datos Documental para el Core en el puerto nativo `27017`.
2.  **`bpm_ia_backend`**: Microservicio en **Python (FastAPI)** que maneja el Asistente NLP y Machine Learning (Puerto `8000`).
3.  **`bpm_core_backend`**: Backend central en **Java (Spring Boot)** que contiene la capa transaccional, AWS S3 SDK y servicios web (Puerto `8080`).
4.  **`bpm_frontend`**: Interfaz de Usuario Web **(Angular)** servida a través de NGINX, accesible en el puerto `4200` simulando producción.

---

## Instrucciones para Compilar y Ejecutar

### 1. Prerrequisitos
*   Tener instalado [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Si usas Windows o Mac) o Docker Engine en Linux.
*   Asegurarte de que los puertos `8080`, `8000`, `4200` y `27017` de tu máquina anfitrión estén libres.

### 2. Levantar el Ecosistema
Abre tu consola de comandos en la carpeta raíz del proyecto (`codigo/`) donde se encuentra el archivo `docker-compose.yml` y ejecuta:

```bash
# Construye las imágenes y levanta los contenedores en segundo plano
docker-compose up -d --build
```

### 3. Verificar el Estado
Comprueba que los cuatro contenedores aparezcan con estado **`Up`**:
```bash
docker-compose ps
```

### 4. Accesos para la Defensa
Una vez funcionando, puedes acceder a los siguientes módulos desde tu navegador local:
*   **Web App (Diseñadores/Funcionarios):** `http://localhost:4200`
*   **API Spring Boot (Documentación/Test):** `http://localhost:8080`
*   **API Inteligencia Artificial (Swagger/Docs):** `http://localhost:8000/docs`

### 5. Apagar el Ecosistema
Cuando termines la defensa o pruebas, puedes apagar la virtualización con:
```bash
docker-compose down
```
*(Si agregas el flag `-v` también destruirás el volumen de datos de MongoDB).*
