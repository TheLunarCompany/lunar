package dev.lunar.interceptor;

import javassist.CannotCompileException;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtField;
import javassist.CtMethod;
import javassist.NotFoundException;

import java.io.IOException;
import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.IllegalClassFormatException;
import java.security.ProtectionDomain;
import java.util.Optional;

public class Interceptor implements ClassFileTransformer {
    // file deepcode ignore LogLevelCheck: <We validate the log level before using>
    private static String okHttp3RealCallCN = "RealCall";
    private static InjectData lunarInject = new InjectData();
    private static LunarLogger logger = LunarLogger.getLogger();

    public static void premain(
            String agentArgs,
            java.lang.instrument.Instrumentation inst) {
        logger.info("Loading Lunar Java Agent");

        if (!Interceptor.validateConfigurations()) {
            logger.warning("Lunar Interceptor is DISABLED!");
            return;
        }

        RoutingData.validateLunarProxyConnection();

        inst.addTransformer(new Interceptor());
        if (logger.isDebugLevel()) {
            logger.debug("Lunar Interceptor is ENABLED!");
        }
    }

    private static boolean validateConfigurations() {
        boolean shouldActivateInterceptor = RoutingData.getProxyHost().isPresent();
        if (!shouldActivateInterceptor) {
            logger.warning(
                    "Could not obtain the Host value of Lunar Proxy from environment variables, "
                            + "please set " + RoutingData.getProxyHostKey() + " "
                            + "to the Lunar Proxy's Lunar Proxy's "
                            + "host/IP and port in order to allow the "
                            + "Interceptor to be loaded.");
        }

        return shouldActivateInterceptor;
    }

    @Override
    public byte[] transform(
            ClassLoader loader,
            String className,
            Class<?> classBeingRedefined,
            ProtectionDomain protectionDomain,
            byte[] classfileBuffer) throws IllegalClassFormatException {
        byte[] byteCode = classfileBuffer;
        Optional<String> classNameObject = Optional.ofNullable(className);
        boolean loaderGotError = false;

        try {
            if (classNameObject.orElse("").endsWith(Interceptor.okHttp3RealCallCN)) {
                byteCode = modifyOkHttpRealCall(loader, className);
            }
        } catch (IllegalClassFormatException | NotFoundException
                | CannotCompileException | IOException e) {
            loaderGotError = true;
            if (logger.isDebugLevel()) {
                logger.debug(
                        "Lunar's could not load the required data for: "
                                + Interceptor.okHttp3RealCallCN,
                        e);
            }
        }

        if (loaderGotError && !logger.isDebugLevel()) {
            logger.warning(
                    "Lunar's Interceptor failed to load, "
                            + "to inspect the errors please run with debug enable.");
        }

        return byteCode;
    }

    /**
     * This is the modification for the okhttp3/RealCall class.
     * {@link} https://github.com/square/okhttp/blob/master/okhttp/src/jvmMain/kotlin/okhttp3/internal/connection/RealCall.kt
     * Here we are working also with the okhttp3/Request class when using the
     * 'originalRequest' object.
     * {@link} https://github.com/square/okhttp/blob/master/okhttp/src/jvmMain/kotlin/okhttp3/Request.kt
     */
    private byte[] modifyOkHttpRealCall(ClassLoader loader, String className)
            throws IllegalClassFormatException, NotFoundException,
            CannotCompileException, IOException {

        if (logger.isDebugLevel()) {
            logger.debug("Trying to modify: '" + className + "'");
        }
        ClassPool cp = ClassPool.getDefault();
        cp.appendPathList(lunarInject.getInterceptorClassPath());
        CtClass cc = cp.get(className.replace("/", "."));

        /*
         * Adding the needed fields from the Interceptor.
         */
        for (String declaration : lunarInject.initializeDeclarations()) {
            cc.addField(CtField.make(declaration, cc));
        }

        /*
         * Modify the used class name to wrap it in case we need to revert the request.
         */
        CtMethod getResponse = cc.getDeclaredMethod(
                "getResponseWithInterceptorChain");
        getResponse.setName("originalGetResponse");

        /*
         * Sets a new method loaded from the pre compiled functions templates
         */
        String executeWrapperTemplate = lunarInject.loadResourceAsString(
                loader,
                "okhttp3/realcall.execute");
        cc.addMethod(CtMethod.make(executeWrapperTemplate, cc));

        String lunarGetResponseWrapperTemplate = lunarInject.loadResourceAsString(
                loader,
                "okhttp3/realcall.lunarGetResponse");
        cc.addMethod(CtMethod.make(lunarGetResponseWrapperTemplate, cc));

        byte[] byteCode = cc.toBytecode();
        cc.detach();
        if (logger.isDebugLevel()) {
            logger.debug("Successfully modified: '" + className + "'");
        }
        return byteCode;
    }
}
