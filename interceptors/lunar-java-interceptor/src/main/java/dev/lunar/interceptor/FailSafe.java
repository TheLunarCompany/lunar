package dev.lunar.interceptor;

import dev.lunar.clock.Clock;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class FailSafe {
    private static final HashMap<String, String> PROXY_ERROR_MAP = new HashMap<String, String>() {
        {
            put("1", "Wrong request, Lunar Proxy could not find header `x-lunar-host` and Proxy was not set to use query params.");
            put("2", "The endpoint cannot be reached");
            put("3", "Gateway timeout");
            put("4", "Lunar Proxy could not find the endpoint");
            put("5", "Lunar Proxy could not resolve host");
        }
    };

    private final class ErrorCounter {

        private int errorsCounter;
        private int maxErrorsAllowed;

        private ErrorCounter(int maxErrorsAllowed) {
            this.maxErrorsAllowed = maxErrorsAllowed;
        }

        /**
         * Count an error when needed.
         * This increases the error counter by 1.
         */
        public void countError() {
            this.errorsCounter++;
        }

        /**
         * Rests the error counter.
         */
        public void resetCounter() {
            this.errorsCounter = 0;
        }

        /**
         * Checks the counter to supply indication regarding failsafe state.
         *
         * @return true if the state is ok, false otherwise.
         */
        public boolean isStateOk() {
            return this.errorsCounter < this.maxErrorsAllowed;
        }
    }

    private final class CooldownControl {
        private final int timeConvertor = 1000;
        private long cooldownTimeMs;
        private long cooldownStartedAtMs;
        private Clock clock;

        private CooldownControl(int cooldownTimeSec, Clock clock) {
            this.cooldownTimeMs = cooldownTimeSec * this.timeConvertor;
            this.clock = clock;
        }

        /**
         * Starts the cooldown timer.
         */
        public void startCooldown() {
            this.cooldownStartedAtMs = clock.currentTimeMillis();
        }

        /**
         * This allows to check the current cooldown state.
         *
         * @return true if the cooldown ended, false otherwise.
         */
        public boolean isCooldownEnded() {
            if (this.cooldownStartedAtMs == 0) {
                return true;
            }

            boolean timerEnded = (clock.currentTimeMillis() - this.cooldownStartedAtMs) >= this.cooldownTimeMs;
            if (timerEnded) {
                this.cooldownStartedAtMs = 0;
            }
            return timerEnded;
        }
    }

    private static FailSafe instance;

    private static int defaultExitAfterSec = 10;
    private static int defaultEnterAfter = 5;
    private static String exitAfterSecKey = "LUNAR_EXIT_COOLDOWN_AFTER_SEC";
    private static String enterAfterAttemptsKey = "LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS";
    private static String headerErrorKey = "x-lunar-error";

    private LunarLogger lunarLogger;
    private CooldownControl cooldownControl;
    private ErrorCounter errorCounter;

    protected FailSafe(
            Optional<Integer> cooldownTimeSec,
            Optional<Integer> maxErrorsAllowed,
            Clock clock) {
        this.lunarLogger = LunarLogger.getLogger();
        this.cooldownControl = new CooldownControl(
                cooldownTimeSec.orElse(
                        LunarHelpers.getIntFromEnv(FailSafe.exitAfterSecKey,
                                FailSafe.defaultExitAfterSec)),
                clock);
        this.errorCounter = new ErrorCounter(
                maxErrorsAllowed.orElse(
                        LunarHelpers.getIntFromEnv(FailSafe.enterAfterAttemptsKey,
                                FailSafe.defaultEnterAfter)));
    }

    /**
     * @param cooldownTimeSec  the time of cooldown on max error exceeded.
     * @param maxErrorsAllowed the amount of error to allow before enter to
     *                         cooldown.
     * @return the instance of the FailSafe(Singleton).
     */
    public static FailSafe getInstance(
            Optional<Integer> cooldownTimeSec,
            Optional<Integer> maxErrorsAllowed,
            Clock clock) {
        if (instance == null) {
            instance = new FailSafe(cooldownTimeSec, maxErrorsAllowed, clock);
        }
        return instance;
    }

    /**
     * Gets the current state of the FailSafe, this is how we know where the request
     * should be routed.
     *
     * @return true if the state is OK, false otherwise.
     */
    public boolean stateOk() {
        return this.cooldownControl.isCooldownEnded();
    }

    /**
     * Notify the FailSafe module that an error is occurred.
     * this will increase the counter and check if the FailSafe should be activated.
     */
    public void onError(String requestId) {
        this.lunarLogger.severe(
            "Request: "
            + requestId
            + " - Error communicating with LunarProxy, "
            + "will revert the request to the original Provider.");
        this.errorCounter.countError();
        this.ensureEnterFailSafe(requestId);
    }

    /**
     * Notify the FailSafe module that an request flow was successful.
     * this will restart the error counter.
     */
    public void onSuccess(String requestId) {
        this.lunarLogger.debug(
            "Request: "
            + requestId
            + " - Got success, resetting error counter.");
        this.errorCounter.resetCounter();
    }

    /**
     * Check if the response headers contains any error passed from the Proxy.
     *
     * @param headers The Headers map witch holds the response headers.
     * @return true if there is an error, false otherwise.
     */
    public boolean isErrorHeader(Map<String, List<String>> headers) {
        if (!headers.containsKey(FailSafe.headerErrorKey)) {
            return false;
        }

        String errorHeaderValue = headers.getOrDefault(FailSafe.headerErrorKey,
            Collections.emptyList()).stream()
            .findFirst()
            .orElse(null);

        String errorMessage = errorHeaderValue != null ? PROXY_ERROR_MAP.getOrDefault(
            errorHeaderValue,
            "Unknown error, Please check the Proxy logs for more information.") : null;

        this.lunarLogger.warning(
            "FailSafe::Error communicating with Lunar Proxy:\n"
            + "Error: " + errorHeaderValue + "\n"
            + "Message: " + errorMessage + "\n"
        );
        return true;
    }

    private void ensureEnterFailSafe(String requestId) {
        if (this.errorCounter.isStateOk()) {
            return;
        }
        this.lunarLogger.debug(
            "Request: "
            + requestId
            + " - Counter exceeds the max attempt limit, starting the cooldown.");
        cooldownControl.startCooldown();
    }
}
