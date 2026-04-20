package com.example.Procesos;

import com.example.Procesos.model.Project;
import com.example.Procesos.repository.ProjectRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

@SpringBootApplication
@EnableMongoAuditing
public class ProcesosApplication {

	public static void main(String[] args) {
		try {
			SpringApplication.run(ProcesosApplication.class, args);
			System.out.println("====================================================");
			System.out.println("EL BACKEND ESTA CORRIENDO CORRECTAMENTE");
			System.out.println("URL: http://localhost:8080");
			System.out.println("====================================================");
		} catch (Exception e) {
			System.err.println("ERROR AL INICIAR EL RECURSO");
			System.err.println("Carpeta del proyecto: " + System.getProperty("user.dir"));
			System.err.println("Motivo del fallo: " + e.getMessage());
			e.printStackTrace();
		}
	}

	@Bean
	CommandLineRunner initDatabase(ProjectRepository repository) {
		return args -> {
			if (repository.count() == 0) {
				Project defaultProject = Project.builder()
						.nombre("Proyecto de Ejemplo Inicial")
						.descripcion("Este proyecto fue creado automáticamente para inicializar la base de datos.")
						.build();
				repository.save(defaultProject);
				System.out.println("Base de datos inicializada con un proyecto de ejemplo.");
			}
		};
	}

}
