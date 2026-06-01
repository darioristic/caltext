import { env } from "@caltext/shared";
import IORedis, { type ChainableCommander, type Redis as IORedisClient } from "ioredis";

/**
 * Local-Redis adapter that exposes the subset of the Upstash REST client API
 * used across this package, so the data layer code stays unchanged while
 * talking to a plain Redis server over TCP (env.REDIS_URL).
 *
 * Key differences from ioredis that are normalized here:
 *  - zadd takes an Upstash-style { score, member } object
 *  - zrange supports an Upstash-style { rev } option
 *  - scan takes an Upstash-style { match, count } options object
 *  - pipeline().exec() returns plain values instead of [err, value] tuples
 */

/** Drop undefined values so they are never written as the literal "undefined". */
function sanitizeHash(
  obj: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

let _redis: RedisAdapter | null = null;

export function getRedis(): RedisAdapter {
  if (!_redis) {
    _redis = new RedisAdapter(new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }));
  }
  return _redis;
}

class PipelineAdapter {
  constructor(private readonly p: ChainableCommander) {}

  hincrbyfloat(key: string, field: string, increment: number): this {
    this.p.hincrbyfloat(key, field, increment);
    return this;
  }
  hincrby(key: string, field: string, increment: number): this {
    this.p.hincrby(key, field, increment);
    return this;
  }
  hset(key: string, obj: Record<string, string | number | undefined>): this {
    this.p.hset(key, sanitizeHash(obj));
    return this;
  }
  hgetall(key: string): this {
    this.p.hgetall(key);
    return this;
  }
  set(
    key: string,
    value: string | number,
    opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean },
  ): this {
    const args: (string | number)[] = [];
    if (opts?.ex !== undefined) args.push("EX", opts.ex);
    if (opts?.px !== undefined) args.push("PX", opts.px);
    if (opts?.nx) args.push("NX");
    if (opts?.xx) args.push("XX");
    // biome-ignore lint/suspicious/noExplicitAny: variadic SET option args
    (this.p.set as any)(key, value, ...args);
    return this;
  }
  del(key: string): this {
    this.p.del(key);
    return this;
  }
  expire(key: string, seconds: number): this {
    this.p.expire(key, seconds);
    return this;
  }
  zadd(key: string, { score, member }: { score: number; member: string }): this {
    this.p.zadd(key, score, member);
    return this;
  }
  zrem(key: string, member: string): this {
    this.p.zrem(key, member);
    return this;
  }

  async exec(): Promise<unknown[]> {
    const results = await this.p.exec();
    if (!results) return [];
    return results.map(([err, value]) => {
      if (err) throw err;
      return value;
    });
  }
}

class RedisAdapter {
  constructor(private readonly redis: IORedisClient) {}

  pipeline(): PipelineAdapter {
    return new PipelineAdapter(this.redis.pipeline());
  }

  async get<T = string | null>(key: string): Promise<T> {
    return (await this.redis.get(key)) as T;
  }
  async set(
    key: string,
    value: string | number,
    opts?: { ex?: number; px?: number; nx?: boolean; xx?: boolean },
  ): Promise<unknown> {
    const args: (string | number)[] = [];
    if (opts?.ex !== undefined) args.push("EX", opts.ex);
    if (opts?.px !== undefined) args.push("PX", opts.px);
    if (opts?.nx) args.push("NX");
    if (opts?.xx) args.push("XX");
    // biome-ignore lint/suspicious/noExplicitAny: variadic SET option args
    return (this.redis.set as any)(key, value, ...args);
  }
  async del(...keys: string[]): Promise<number> {
    return this.redis.del(...keys);
  }
  async exists(key: string): Promise<number> {
    return this.redis.exists(key);
  }
  async hget<T = string | null>(key: string, field: string): Promise<T> {
    return (await this.redis.hget(key, field)) as T;
  }
  async hset(key: string, obj: Record<string, string | number | undefined>): Promise<number> {
    return this.redis.hset(key, sanitizeHash(obj));
  }
  async hgetall<T = Record<string, string>>(key: string): Promise<T> {
    return (await this.redis.hgetall(key)) as T;
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.redis.hdel(key, ...fields);
  }
  async zadd(
    key: string,
    { score, member }: { score: number; member: string },
  ): Promise<number | null> {
    return this.redis.zadd(key, score, member);
  }
  async zrange<T = string[]>(
    key: string,
    start: number,
    stop: number,
    opts?: { rev?: boolean },
  ): Promise<T> {
    const result = opts?.rev
      ? await this.redis.zrevrange(key, start, stop)
      : await this.redis.zrange(key, start, stop);
    return result as T;
  }
  async scan(cursor: number, opts: { match: string; count: number }): Promise<[string, string[]]> {
    const [next, keys] = await this.redis.scan(cursor, "MATCH", opts.match, "COUNT", opts.count);
    return [next, keys];
  }
}
