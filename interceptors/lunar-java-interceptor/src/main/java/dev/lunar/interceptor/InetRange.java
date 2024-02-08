package dev.lunar.interceptor;

import java.net.InetAddress;

public class InetRange {

    private static long shift8 = 8;
    private static int leastSignificantByte = 0xff;
    private InetAddress start;
    private InetAddress end;

    public InetRange(InetAddress start, InetAddress end) {
        this.start = start;
        this.end = end;
    }

    public InetAddress getStart() {
        return start;
    }

    public InetAddress getEnd() {
        return end;
    }

    public boolean isInRange(InetAddress address) {
        long ipLong = ipToLong(address);
        long startLong = ipToLong(start);
        long endLong = ipToLong(end);

        return startLong <= ipLong && ipLong <= endLong;
    }

    private long ipToLong(InetAddress ip) {
        byte[] octets = ip.getAddress();
        long result = 0;

        for (byte octet : octets) {
            result <<= InetRange.shift8;
            result |= octet & InetRange.leastSignificantByte;
        }

        return result;
    }
}
