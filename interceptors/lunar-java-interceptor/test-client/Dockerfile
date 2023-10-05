FROM maven:3.8.3-openjdk-8

WORKDIR /
COPY . ./lunar-java-interceptor

WORKDIR /lunar-java-interceptor
RUN mvn clean install -e -DskipTests

WORKDIR /lunar-java-interceptor/test-client
RUN mvn clean install -e -DskipTests

WORKDIR /lunar-java-interceptor

ENTRYPOINT ["java", "-javaagent:target/lunar-interceptor.jar", "-jar", "test-client/target/client.jar"]
