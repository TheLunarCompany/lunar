export class EngineVersion {
    major: number;
    minor: number;
    fix: number;

    constructor(major: number, minor: number, fix: number) {
        this.major = major;
        this.minor = minor;
        this.fix = fix;
    }

    isEqualTo(other: EngineVersion): boolean {
        return this.major === other.major && 
               this.minor === other.minor && 
               this.fix === other.fix;
    }

    isLessThan(other: EngineVersion): boolean {
        if (this.major < other.major) return true;
        if (this.major > other.major) return false;
        if (this.minor < other.minor) return true;
        if (this.minor > other.minor) return false;
        return this.fix < other.fix;
    }
    
    isEqualOrGreaterThan(other: EngineVersion): boolean {
        return !this.isLessThan(other) || this.isEqualTo(other);
    }

    isGreaterThan(other: EngineVersion): boolean {
        return !this.isLessThan(other) && !this.isEqualTo(other);
    }

    inRange(from: EngineVersion, to: EngineVersion): boolean {
        return this.isEqualOrGreaterThan(from) &&
               this.isLessThan(to);
    }
}
