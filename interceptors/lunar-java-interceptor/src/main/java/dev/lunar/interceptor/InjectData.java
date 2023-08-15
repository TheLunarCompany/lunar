package dev.lunar.interceptor;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Scanner;

public class InjectData {

    public InjectData() {
    }

    protected String loadResourceAsString(
            ClassLoader loader,
            String resourceName) {
        try (
                InputStream is = loader.getResourceAsStream(resourceName);
                Scanner scanner = new Scanner(is, StandardCharsets.UTF_8.name())) {
            return scanner.useDelimiter("\\A").next();
        } catch (java.io.IOException e) {
            throw new RuntimeException("Error loading resource " + resourceName, e);
        }
    }

    /**
     * @return A string with the relevant class path for the Interceptor to Inject.
     */
    protected String getInterceptorClassPath() {
        return "dev.lunar.interceptor.FailSafe,dev.lunar.interceptor.RoutingData,"
                + "dev.lunar.interceptor.LunarLogger,dev.lunar.interceptor.TrafficFilter";
    }

    /**
     * To use this, you should go through the list using forEach.
     * For example:
     * for (String declaration : lunarInject.initializeDeclarations())
     * {cc.addField(CtField.make(declaration, cc));}
     *
     * @return A list the required declaration to inject into the clients JVM
     *         process.
     */
    @SuppressWarnings("checkstyle:LineLength")
    protected List<String> initializeDeclarations() {
        return Arrays.asList(
                "private boolean lunarGotError = false;",
                "private dev.lunar.interceptor.RoutingData routingData;",
                "private dev.lunar.interceptor.Retry lunarRetry = new dev.lunar.interceptor.Retry();",
                "private dev.lunar.interceptor.LunarLogger lunarLogger = dev.lunar.interceptor.LunarLogger.getLogger();",
                "private dev.lunar.interceptor.TrafficFilter trafficFilter = dev.lunar.interceptor.TrafficFilter.getInstance();",
                "private dev.lunar.interceptor.FailSafe failSafe = dev.lunar.interceptor.FailSafe.getInstance(java.util.Optional.empty(), java.util.Optional.empty(), new dev.lunar.clock.RealClock());"
                );
    }
}
