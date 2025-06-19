package org.finos.gitproxy.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.proxy.AsyncMiddleManServlet;
import org.finos.gitproxy.git.GitRequestDetails;

import java.io.IOException;

@Slf4j
public class GitProxyServlet extends AsyncMiddleManServlet.Transparent {
    public static final String GIT_REQUEST_ATTRIBUTE = "org.finos.gitproxy.gitproxy.gitRequest";

    @Override
    protected void service(HttpServletRequest clientRequest, HttpServletResponse proxyResponse) throws ServletException, IOException {
        var details = (GitRequestDetails) clientRequest.getAttribute(GIT_REQUEST_ATTRIBUTE);
        var canProxy = details != null && details.getResult() == GitRequestDetails.GitResult.ALLOWED;
        if (canProxy) {
            super.service(clientRequest, proxyResponse);
            clientRequest.getHeaderNames().asIterator().forEachRemaining(header -> {
                            if (!"authorization".equalsIgnoreCase(header)) {
                                var value = clientRequest.getHeader(header);
                                log.info("Client Request Header: {} = {}", header, value);
                            }
                        });
                        proxyResponse.getHeaderNames().forEach(header -> {
                            if (!"authorization".equalsIgnoreCase(header)) {
                                var value = proxyResponse.getHeader(header);
                                log.info("Proxy Response Header: {} = {}", header, value);
                            }
                        });
        }
    }
}
