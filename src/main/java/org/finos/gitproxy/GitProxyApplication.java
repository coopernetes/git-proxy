package org.finos.gitproxy;

        import jakarta.servlet.DispatcherType;
        import org.eclipse.jetty.ee10.proxy.AsyncMiddleManServlet;
        import org.eclipse.jetty.ee10.servlet.FilterHolder;
        import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
        import org.eclipse.jetty.ee10.servlet.ServletHolder;
        import org.eclipse.jetty.server.Server;
        import org.eclipse.jetty.server.ServerConnector;
        import org.eclipse.jetty.util.thread.QueuedThreadPool;
        import org.finos.gitproxy.provider.GitHubProvider;
        import org.finos.gitproxy.servlet.GitProxyProviderServlet;
        import org.finos.gitproxy.servlet.GitProxyServlet;
        import org.finos.gitproxy.servlet.filter.AuditLogFilter;
        import org.finos.gitproxy.servlet.filter.ForceGitClientFilter;
        import org.finos.gitproxy.servlet.filter.ParseRequestFilter;
        import org.mitre.dsmiley.httpproxy.ProxyServlet;

        import java.util.EnumSet;

public class GitProxyApplication {
            public static void main(String[] args) throws Exception {
                var threadPool = new QueuedThreadPool();
                threadPool.setName("server");

                var server = new Server(threadPool);

                var connector = new ServerConnector(server);
                connector.setPort(8080);
                server.addConnector(connector);

                var gitHubProvider = new GitHubProvider("");
                String urlPattern = gitHubProvider.servletMapping();

                var context = new ServletContextHandler();
                context.setContextPath("/");

                var forceGitClientFilter = new ForceGitClientFilter();
                var forceGitClientFilterHolder = new FilterHolder(forceGitClientFilter);
                context.addFilter(forceGitClientFilterHolder, urlPattern, EnumSet.of(DispatcherType.REQUEST));

                var parseRequestFilter = new ParseRequestFilter(gitHubProvider);
                var parseRequestFilterHolder = new FilterHolder(parseRequestFilter);
                context.addFilter(parseRequestFilterHolder, urlPattern, EnumSet.of(DispatcherType.REQUEST));

                var auditFilter = new AuditLogFilter();
                var auditFilterHolder = new FilterHolder(auditFilter);
                context.addFilter(auditFilterHolder, urlPattern, EnumSet.of(DispatcherType.REQUEST));

                var testServlet = new ServletHolder(new GitProxyServlet());
                testServlet.setInitParameter("proxyTo", "https://github.com");
                testServlet.setInitParameter("prefix", "/github.com");
                testServlet.setInitParameter("preserveHost", "true");
                context.addServlet(testServlet, urlPattern);

                server.setHandler(context);

                server.start();
                System.out.println("Server started at http://localhost:8080/");
                server.join();
            }
        }