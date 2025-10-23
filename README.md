# Test City

**Test City** visualizes and analyzes software quality metrics such as test coverage, complexity, and mutation results.  
It uses interactive 3D representations to help understand code structure, testing strength, and maintainability at a glance.

---

## How to Run

### Run with Docker

1. Make sure you have **Docker** and **Docker Compose** installed.  
   You can follow the installation guide here:  
   [https://docs.docker.com/desktop/setup/install/mac-install/](https://docs.docker.com/desktop/setup/install/mac-install/)

2. Ensure **Docker** is running.  
   - On macOS/Windows, open **Docker Desktop**.  
   - On Linux, you may need to start it manually using:
     ```bash
     sudo systemctl start docker
     ```

3. Download this repository.  
   *(Note: This is an anonymous repository and cannot be cloned from GitHub.)*  
   *(You can download it using the **Download Repository** button at the top-right corner.)*
4. Unzip file
5.	Start all services (if Docker asks for permission to access files, please allow it):
      ```bash
      cd Test-City-6E3E
      docker compose up
      ```
      Note: If your system uses the legacy docker-compose, use:`docker-compose up`


7. Access **Test City** at:
[http://localhost:5173](http://localhost:5173)  


### Accessing the Services

After running `docker compose up`, the following services will be available:

| Service | Description | Port(s) | URL |
|----------|--------------|----------|------|
| **frontend** | Visualization UI built with Three.js and Vite for displaying code and test coverage metrics. | `5173` | [http://localhost:5173](http://localhost:5173) |
| **minio** | Object storage for report files (S3-compatible). Console available for managing uploaded results and PIT reports. | `9000`, `9001` | [http://localhost:9001](http://localhost:9001) |
| **server** | Python FastAPI backend (data collector and report processor). | `8000` | [http://localhost:8000](http://localhost:8000) |
| **java-server** | Java-based block extractor service for parsing and analyzing test data. | `8080` | [http://localhost:8080](http://localhost:8080) |
