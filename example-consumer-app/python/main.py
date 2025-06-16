import lunar_interceptor
import asyncio
import aiohttp
from aioconsole import ainput


SLEEP_INTERVAL_IN_SEC = 2
URL = "https://catfact.ninja/fact"
X_LUNAR_CONSUMER_TAG = "lunar-example-app"

async def get_cat_fact(session, stop_event):
    while not stop_event.is_set():
        try:
            headers = {
                "x-lunar-consumer-tag": X_LUNAR_CONSUMER_TAG
            }
            async with session.get(URL, headers=headers) as response:
                if response.status == 200:
                    fact = (await response.json()).get("fact")
                    print(f"Cat Fact: {fact}")
                else:
                    print(
                        f"Failed to retrieve cat fact. Status code {response.status_code}"
                    )
        except Exception as e:
            print(f"An error occurred: {e}")

        await asyncio.sleep(SLEEP_INTERVAL_IN_SEC)


async def wait_for_input(stop_event):
    await ainput("Press Enter to stop...\n")
    stop_event.set()


async def main():
    # Event to signal when to stop the asyncio loop
    stop_event = asyncio.Event()

    await ainput("Press Enter to get a cat fact...")
    print(f"Sending a request to {URL} every {SLEEP_INTERVAL_IN_SEC} seconds")

    async with aiohttp.ClientSession() as session:
        fact_task = asyncio.create_task(get_cat_fact(session, stop_event))
        input_task = asyncio.create_task(wait_for_input(stop_event))

        # Wait for the fact_task and input_task to complete
        await asyncio.wait([fact_task, input_task], return_when=asyncio.ALL_COMPLETED)


if __name__ == "__main__":
    asyncio.run(main())
