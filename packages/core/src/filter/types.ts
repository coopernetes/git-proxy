export default interface Filter {
  doFilter(message: string): Promise<string>;
}
