# Lunar example consumer app 

This simple Python application fetches a random cat fact from the web when the user presses Enter using the Lunar-Proxy.

## Installation

Before running the app, ensure you have Python installed on your computer. This app is compatible with Python 3.x versions.

### Setting up the Environment

 **Install Dependencies**: Navigate to the project's root directory and run the following command to install the required Python packages:

  ```bash
  pip install -r requirements.txt
  ```

 **To run the client with Lunar**: Go to main.py and remove the commented import line
  Set the LUNAR_PROXY_HOST environment variable. This variable should be set to the host or IP of Lunar Proxy, including the port it is listening on. Run the client.
 
  ```bash
  export LUNAR_PROXY_HOST="lunar-proxy:8000"
  python main.py
  ```
