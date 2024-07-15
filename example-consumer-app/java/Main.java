import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.Call;
import java.io.IOException;
import java.util.Scanner;
import java.util.concurrent.TimeUnit;

public class Main {

    private static final String URL = "https://catfact.ninja/fact";
    private static final long SLEEP_INTERVAL_IN_SEC = 2; // seconds

    public static void main(String[] args) {
        OkHttpClient client = new OkHttpClient.Builder()
                .build();

        // Create a Runnable task for fetching cat facts
        Runnable catFactFetcher = () -> {
            System.out.println("Press Enter in the console to stop fetching cat facts...");
            while (!Thread.currentThread().isInterrupted()) {
                Request request = new Request.Builder()
                        .url(URL)
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (response.isSuccessful() && response.body() != null) {
                        String responseBody = response.body().string();
                        System.out.println("Cat Fact: " + responseBody);
                    } else {
                        System.out.println("Failed to retrieve cat fact. Status code: " + response.code());
                    }
                } catch (IOException e) {
                    System.out.println("An error occurred: " + e.getMessage());
                    Thread.currentThread().interrupt(); // Interrupt the thread on error
                }

                try {
                    TimeUnit.SECONDS.sleep(SLEEP_INTERVAL_IN_SEC);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); // Restore the interrupted status
                }
            }
        };

        Thread catFactThread = new Thread(catFactFetcher);
        catFactThread.start();

        // Wait for the user to press Enter to stop
        new Scanner(System.in).nextLine();
        catFactThread.interrupt(); // Interrupt the fetching thread to stop it
        try {
            catFactThread.join(); // Wait for the thread to finish
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("Stopped fetching cat facts.");
    }
}
