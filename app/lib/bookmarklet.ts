export function createAddPageHref(deploymentUrl: string): string {
  let deployment: URL;

  try {
    deployment = new URL(deploymentUrl);
  } catch {
    throw new TypeError('The deployment needs a valid web address.');
  }

  if (deployment.protocol !== 'https:' && deployment.protocol !== 'http:') {
    throw new TypeError('The deployment needs a valid web address.');
  }

  return new URL('/add', deployment.origin).toString();
}

export function createBookmarkletHref(deploymentUrl: string): string {
  const addUrl = createAddPageHref(deploymentUrl);

  return `javascript:(()=>{const destination=new URL(${JSON.stringify(addUrl)});destination.searchParams.set('url',location.href);window.open(destination.toString(),'_blank','noopener')})()`;
}
