import Filter from './types';

export class FilterChain implements Filter {
    private filters: Filter[] = [];

    constructor(filters: Filter[] = []) {
      this.filters = filters;
    }


    public addFilter(filter: Filter): void {
        this.filters.push(filter);
    }

    public doFilter(message: string): string {
        let result = message;
        for (const filter of this.filters) {
            result = filter.doFilter(result);
        }
        return result;
    }
}

export class AsyncFilterChain implements Filter {
    private filters: Filter[] = [];
    private queue: 

    constructor(filters: Filter[] = []) {
      this.filters = filters;
    }

    public addFilter(filter: Filter): void {
        this.filters.push(filter);
    }

    public async doFilter(message: string): Promise<string> {
        let result = message;
        for (const filter of this.filters) {
            result = await filter.doFilter(result);
        }
        return result;
    }
}