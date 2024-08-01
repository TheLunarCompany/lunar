import lunar_interceptor  # type: ignore

import asyncio
from os.path import join, dirname, abspath

from lunar import import_skd_files


SDKs = import_skd_files(join(abspath(dirname(__file__)), "sdks"))

for sdk in SDKs:
  print(f"Loaded SDK: {sdk.get_name()}")

  
async def run_async() -> bool:
  print("Running async SDK tests")
  for sdk in SDKs:
    try:
      print(f"Testing async on {sdk.get_name()}")
      failed = await sdk.test_async()

      print(f"Testing stream async on {sdk.get_name()}")
      return failed and await sdk.test_stream_async()
    
    except Exception as e:
      print(f"Error testing {sdk.get_name()}: {e}")
      
  return True


def run() -> bool:
  print("Running SDK tests")
  for sdk in SDKs:
    try:
      print(f"Testing sync on {sdk.get_name()}")
      failed = sdk.test()

      print(f"Testing sync stream on {sdk.get_name()}")
      return failed and sdk.test_stream()
    
    except Exception as e:
      print(f"Error testing {sdk.get_name()}: {e}")
      
  return True

def report_error(message: str,):
  error_message = f"::error::{message}"
  print(error_message)
  exit(1)


async def main():
  if not run() and await run_async():
    report_error("Some SDK tests failed, check logs for more information")


if __name__ == "__main__":
  asyncio.run(main())