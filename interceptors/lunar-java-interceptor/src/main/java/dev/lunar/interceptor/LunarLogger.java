package dev.lunar.interceptor;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Optional;
import java.util.logging.ConsoleHandler;
import java.util.logging.Formatter;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;

public final class LunarLogger extends Logger {

    static final class DebugLevel extends Level {

        public static final String DEBUG_NAME = "DEBUG";
        public static final DebugLevel DEBUG_LEVEL = new DebugLevel(
                DEBUG_NAME,
                Level.INFO.intValue() - 1);

        private DebugLevel(String name, int value) {
            super(name, value);
        }

        public static Level parse(String name) throws IllegalArgumentException {
            if (name != null && name.toUpperCase().equals(DEBUG_NAME)) {
                return DEBUG_LEVEL;
            }
            return Level.parse(name);
        }

    }

    private static class LunarFormatter extends Formatter {

        private static final String LOG_DELIMITER = " - ";
        private static final DateFormat DATE_FORMAT = new SimpleDateFormat(
            "yyyy-MM-dd HH:mm:ss,SSS");

        @Override
        public String format(LogRecord record) {
            StringBuilder builder = new StringBuilder();
            String logLevel = record.getLevel() + ": ";
            builder.append(DATE_FORMAT.format(new Date(record.getMillis())));
            builder.append(LOG_DELIMITER);
            builder.append(record.getLoggerName());
            builder.append(LOG_DELIMITER);
            builder.append(logLevel);
            builder.append(formatMessage(record));
            builder.append(System.lineSeparator());
            return builder.toString();
        }
    }

    private static String loggerName = "lunar-interceptor";

    private static LunarLogger lunarLogger;

    private LunarLogger() {
        super(LunarLogger.loggerName, null);
        Level logLevel = this.getLogLevel();
        super.setLevel(logLevel);
        setUseParentHandlers(false);

        Handler consoleHandler = new ConsoleHandler();
        consoleHandler.setLevel(logLevel);
        consoleHandler.setFormatter(new LunarFormatter());
        addHandler(consoleHandler);
    }

    public static LunarLogger getLogger() {
        if (lunarLogger == null) {
            lunarLogger = new LunarLogger();
        }
        return lunarLogger;
    }

    public boolean isDebugLevel() {
        return DebugLevel.DEBUG_LEVEL == this.getLevel();
    }

    public void debug(String msg) {
        log(DebugLevel.DEBUG_LEVEL, msg);
    }

    public void debug(String msg, Exception e) {
        debug(msg + formatException(e) + "\ncaused by: " + formatException(e.getCause()));
    }

    public void warning(String msg, Exception e) {
        warning(msg + formatException(e) + "\ncaused by: " + formatException(e.getCause()));
    }

    private String formatException(Throwable e) {
        String error = "error: " + e.getMessage();

        String formattedStackTrace = "trace:";

        for (StackTraceElement traceElement : e.getStackTrace()) {
            formattedStackTrace += "\n\tat " + traceElement;
        }

        return error + "\n" + formattedStackTrace;
    }

    private Level getLogLevel() {
        return Optional
                .ofNullable(System.getenv("LUNAR_INTERCEPTOR_LOG_LEVEL"))
                .map(level -> DebugLevel.parse(level))
                .orElse(Level.INFO);
    }
}
