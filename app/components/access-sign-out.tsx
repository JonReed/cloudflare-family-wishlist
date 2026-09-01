export function AccessSignOut({ email }: { email: string }) {
  return (
    <details className="profile-sign-out">
      <summary>Sign out on all devices</summary>
      <div className="profile-sign-out-body">
        <p>
          This signs <strong>{email}</strong> out on every phone, tablet and computer. Other family
          members stay signed in.
        </p>
        <a href="/cdn-cgi/access/logout" className="button-danger">
          Yes, sign out everywhere
        </a>
      </div>
    </details>
  );
}
